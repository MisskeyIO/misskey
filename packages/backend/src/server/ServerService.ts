/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import cluster from 'node:cluster';
import os from 'node:os';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyRawBody from 'fastify-raw-body';
import { IsNull } from 'typeorm';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import type { Config } from '@/config.js';
import type { EmojisRepository, MiMeta, UserProfilesRepository, UsersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import type Logger from '@/logger.js';
import * as Acct from '@/misc/acct.js';
import { genIdenticon } from '@/misc/gen-identicon.js';
import { appendQuery, omitHttps, query } from '@/misc/prelude/url.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { bindThis } from '@/decorators.js';
import { ActivityPubServerService } from './ActivityPubServerService.js';
import { NodeinfoServerService } from './NodeinfoServerService.js';
import { ApiServerService } from './api/ApiServerService.js';
import { StreamingApiServerService } from './api/StreamingApiServerService.js';
import { WellKnownServerService } from './WellKnownServerService.js';
import { FileServerService } from './FileServerService.js';
import { ClientServerService } from './web/ClientServerService.js';
import { OpenApiServerService } from './api/openapi/OpenApiServerService.js';
import { OAuth2ProviderService } from './oauth/OAuth2ProviderService.js';
import { JWTIdentifyProviderService } from './sso/JWTIdentifyProviderService.js';
import { SAMLIdentifyProviderService } from './sso/SAMLIdentifyProviderService.js';

const _dirname = fileURLToPath(new URL('.', import.meta.url));

@Injectable()
export class ServerService implements OnApplicationShutdown {
	private logger: Logger;
	#fastify: FastifyInstance;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private userEntityService: UserEntityService,
		private apiServerService: ApiServerService,
		private openApiServerService: OpenApiServerService,
		private streamingApiServerService: StreamingApiServerService,
		private activityPubServerService: ActivityPubServerService,
		private wellKnownServerService: WellKnownServerService,
		private nodeinfoServerService: NodeinfoServerService,
		private fileServerService: FileServerService,
		private clientServerService: ClientServerService,
		private globalEventService: GlobalEventService,
		private loggerService: LoggerService,
		private oauth2ProviderService: OAuth2ProviderService,
		private jwtIdentifyProviderService: JWTIdentifyProviderService,
		private samlIdentifyProviderService: SAMLIdentifyProviderService,
	) {
		this.logger = this.loggerService.getLogger('server', 'gray');
	}

	@bindThis
	public async launch() {
		const fastify = Fastify({
			logger: false,
			maxParamLength: 1024,
			trustProxy: true,
		});
		this.#fastify = fastify;

		// HSTS
		// 6months (15552000sec)
		if (this.config.url.startsWith('https') && !this.config.disableHsts) {
			fastify.addHook('onRequest', (request, reply, done) => {
				reply.header('strict-transport-security', 'max-age=15552000; preload');
				done();
			});
		}

		// Register raw-body parser for ActivityPub HTTP signature validation.
		await fastify.register(fastifyRawBody, {
			global: false,
			encoding: null,
			runFirst: true,
		});

		// Register non-serving static server so that the child services can use reply.sendFile.
		// `root` here is just a placeholder and each call must use its own `rootPath`.
		fastify.register(fastifyStatic, {
			root: _dirname,
			serve: false,
		});

		const hostname = os.hostname();
		fastify.addHook('onRequest', (request, reply, done) => {
			reply.header('x-worker-host', hostname);
			done();
		});

		// if the requester looks like to be performing an ActivityPub object lookup, reject all external redirects
		//
		// this will break lookup that involve copying a URL from a third-party server, like trying to lookup http://charlie.example.com/@alice@alice.com
		//
		// this is not required by standard but protect us from peers that did not validate final URL.
		if (this.config.disallowExternalApRedirect) {
			const maybeApLookupRegex = /application\/activity\+json|application\/ld\+json.+activitystreams/i;
			fastify.addHook('onSend', (request, reply, _, done) => {
				const location = reply.getHeader('location');
				if (reply.statusCode < 300 || reply.statusCode >= 400 || typeof location !== 'string') {
					done();
					return;
				}

				if (!maybeApLookupRegex.test(request.headers.accept ?? '')) {
					done();
					return;
				}

				const effectiveLocation = process.env.NODE_ENV === 'production' ? location : location.replace(/^http:\/\//, 'https://');
				if (effectiveLocation.startsWith(`https://${this.config.host}/`)) {
					done();
					return;
				}

				reply.status(406);
				reply.removeHeader('location');
				reply.header('content-type', 'text/plain; charset=utf-8');
				reply.header('link', `<${encodeURI(location)}>; rel="canonical"`);
				done(null, [
					'Refusing to relay remote ActivityPub object lookup.',
					'',
					`Please remove 'application/activity+json' and 'application/ld+json' from the Accept header or fetch using the authoritative URL at ${location}.`,
				].join('\n'));
			});
		}

		fastify.register(this.apiServerService.createServer, { prefix: '/api' });
		fastify.register(this.openApiServerService.createServer);
		fastify.register(this.fileServerService.createServer);
		fastify.register(this.activityPubServerService.createServer);
		fastify.register(this.nodeinfoServerService.createServer);
		fastify.register(this.wellKnownServerService.createServer);
		fastify.register(this.oauth2ProviderService.createServer, { prefix: '/oauth' });
		fastify.register(this.oauth2ProviderService.createApiServer, { prefix: '/oauth/api' });
		fastify.register(this.oauth2ProviderService.createTokenServer, { prefix: '/oauth/token' });
		fastify.register(this.samlIdentifyProviderService.createServer, { prefix: '/sso/saml' });
		fastify.register(this.jwtIdentifyProviderService.createServer, { prefix: '/sso/jwt' });
		fastify.register(this.jwtIdentifyProviderService.createApiServer, { prefix: '/sso/jwt/api' });
		// fastify.register(this.healthServerService.createServer, { prefix: '/healthz' }); // TODO: あとでまっちゃとーにゅさんに消すか聞く

		fastify.get<{ Params: { path: string }; Querystring: { static?: any; badge?: any; }; }>('/emoji/:path(.*)', async (request, reply) => {
			const path = request.params.path;

			reply.header('Cache-Control', 'public, max-age=86400');

			if (!path.match(/^[a-zA-Z0-9\-_@\.]+?\.webp$/)) {
				reply.code(404);
				return;
			}

			const emojiPath = path.replace(/\.webp$/i, '');
			const pathChunks = emojiPath.split('@');

			if (pathChunks.length > 2) {
				reply.code(400);
				return;
			}

			const name = pathChunks.shift();
			const host = pathChunks.pop();

			const emoji = await this.emojisRepository.findOneBy({
				// `@.` is the spec of ReactionService.decodeReaction
				host: (host === undefined || host === '.') ? IsNull() : host,
				name: name,
			});

			reply.header('Content-Security-Policy', 'default-src \'none\'; style-src \'unsafe-inline\'');

			if (emoji == null) {
				if ('fallback' in request.query) {
					return reply.redirect('/static-assets/emoji-unknown.png');
				} else {
					reply.code(404);
					return;
				}
			}

			let url: string;
			if ('badge' in request.query) {
				url = appendQuery(
					// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
					`${this.config.mediaProxy}/emoji/${encodeURIComponent(omitHttps(emoji.publicUrl || emoji.originalUrl))}`,
					query({
						badge: '1',
					}),
				);
			} else {
				url = appendQuery(
					// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
					`${this.config.mediaProxy}/emoji/${encodeURIComponent(omitHttps(emoji.publicUrl || emoji.originalUrl))}`,
					query({
						emoji: '1',
						...('static' in request.query ? { static: '1' } : {}),
					}),
				);
			}

			return reply.redirect(
				url,
				302,
			);
		});

		fastify.get<{ Params: { acct: string } }>('/avatar/@:acct', async (request, reply) => {
			const { username, host } = Acct.parse(request.params.acct);
			const user = await this.usersRepository.findOne({
				where: {
					usernameLower: username.toLowerCase(),
					host: (host == null) || (host === this.config.host) ? IsNull() : host,
					isSuspended: false,
				},
			});

			reply.header('Cache-Control', 'public, max-age=86400');

			if (user) {
				reply.redirect((user.avatarId == null ? null : user.avatarUrl) ?? this.userEntityService.getIdenticonUrl(user));
			} else {
				reply.redirect('/static-assets/user-unknown.png');
			}
		});

		fastify.get<{ Params: { x: string } }>('/identicon/:x', async (request, reply) => {
			reply.header('Content-Type', 'image/png');
			reply.header('Cache-Control', 'public, max-age=86400');

			if (this.meta.enableIdenticonGeneration) {
				return await genIdenticon(request.params.x);
			} else {
				return reply.redirect('/static-assets/avatar.png');
			}
		});

		fastify.get<{ Params: { code: string } }>('/verify-email/:code', async (request, reply) => {
			const profile = await this.userProfilesRepository.findOneBy({
				emailVerifyCode: request.params.code,
			});

			if (profile != null) {
				await this.userProfilesRepository.update({ userId: profile.userId }, {
					emailVerified: true,
					emailVerifyCode: null,
				});

				this.globalEventService.publishMainStream(profile.userId, 'meUpdated', await this.userEntityService.pack(profile.userId, { id: profile.userId }, {
					schema: 'MeDetailed',
					includeSecrets: true,
				}));

				reply.code(200).send('Verification succeeded! メールアドレスの認証に成功しました。');
				return;
			} else {
				reply.code(404).send('Verification failed. Please try again. メールアドレスの認証に失敗しました。もう一度お試しください');
				return;
			}
		});

		fastify.register(this.clientServerService.createServer);

		this.streamingApiServerService.attach(fastify.server);

		fastify.server.on('error', err => {
			switch ((err as any).code) {
				case 'EACCES':
					this.logger.error(`You do not have permission to listen on port ${this.config.port}.`);
					break;
				case 'EADDRINUSE':
					this.logger.error(`Port ${this.config.port} is already in use by another process.`);
					break;
				default:
					this.logger.error(err);
					break;
			}

			if (cluster.isWorker) {
				process.send!('listenFailed');
			} else {
				// disableClustering
				process.exit(1);
			}
		});

		if (this.config.socket) {
			if (fs.existsSync(this.config.socket)) {
				fs.unlinkSync(this.config.socket);
			}
			fastify.listen({ path: this.config.socket }, (err, address) => {
				if (this.config.chmodSocket) {
					fs.chmodSync(this.config.socket!, this.config.chmodSocket);
				}
			});
		} else {
			fastify.listen({ port: this.config.port, host: '::' });
		}

		await fastify.ready();
		return fastify;
	}

	@bindThis
	public async dispose(): Promise<void> {
		this.streamingApiServerService.detach();
		await this.#fastify.close();
	}

	@bindThis
	async onApplicationShutdown(signal: string): Promise<void> {
		await this.dispose();
	}
}
