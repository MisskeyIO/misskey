/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as stream from 'node:stream/promises';
import { Transform } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { DI } from '@/di-symbols.js';
import { getIpHash } from '@/misc/get-ip-hash.js';
import type { MiLocalUser, MiUser } from '@/models/User.js';
import type { MiAccessToken } from '@/models/AccessToken.js';
import type Logger from '@/logger.js';
import type { UserIpsRepository } from '@/models/_.js';
import { createTemp } from '@/misc/create-temp.js';
import { AttachmentFile } from '@/server/api/endpoint-base.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import type { Config } from '@/config.js';
import { MetaService } from '@/core/MetaService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { ApiError } from './error.js';
import { RateLimiterService } from './RateLimiterService.js';
import { ApiLoggerService } from './ApiLoggerService.js';
import { AuthenticateService, AuthenticationError } from './AuthenticateService.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IEndpoint, IEndpointMeta } from './endpoints.js';
import type { OnApplicationShutdown } from '@nestjs/common';

const accessDenied = <ConstructorParameters<typeof ApiError>[0]>{
	message: 'Access denied.',
	code: 'ACCESS_DENIED',
	id: '56f35758-7dd5-468b-8439-5d6fb8ec9b8e',
	httpStatusCode: 403,
	kind: 'client',
};

const uploadFileSizeExceeded = <ConstructorParameters<typeof ApiError>[0]>{
	message: 'Maximum upload size exceeded',
	code: 'MAX_FILE_SIZE_EXCEEDED',
	id: '39591dd6-b5e8-4399-bb03-13b0a8a62a21',
	httpStatusCode: 413,
	kind: 'client',
};

type PreparedFile = {
	file: AttachmentFile;
	size: number;
	cleanup: () => void;
};

@Injectable()
export class ApiCallService implements OnApplicationShutdown {
	private logger: Logger;
	private userIpHistories: Map<MiUser['id'], Set<string>>;
	private userIpHistoriesClearIntervalId: NodeJS.Timeout;

	constructor(
		@Inject(DI.config)
		private config: Config,
		@Inject(DI.userIpsRepository)
		private userIpsRepository: UserIpsRepository,
		private metaService: MetaService,
		private authenticateService: AuthenticateService,
		private rateLimiterService: RateLimiterService,
		private roleService: RoleService,
		private apiLoggerService: ApiLoggerService,
	) {
		this.logger = this.apiLoggerService.logger;
		this.userIpHistories = new Map<MiUser['id'], Set<string>>();

		this.userIpHistoriesClearIntervalId = setInterval(() => {
			this.userIpHistories.clear();
		}, 1000 * 60 * 60);
	}

	#sendApiError(reply: FastifyReply, err: ApiError): void {
		let statusCode = err.httpStatusCode;
		if (err.httpStatusCode === 401) {
			if (!reply.getHeader('WWW-Authenticate')) {
				reply.header('WWW-Authenticate', 'Bearer realm="Misskey"');
			}
		} else if (err.code === 'RATE_LIMIT_EXCEEDED') {
			const info: unknown = err.info;
			const unixEpochInSeconds = Date.now();
			if (typeof (info) === 'object' && info && 'resetMs' in info && typeof (info.resetMs) === 'number') {
				const cooldownInSeconds = Math.ceil((info.resetMs - unixEpochInSeconds) / 1000);
				// もしかするとマイナスになる可能性がなくはないのでマイナスだったら0にしておく
				reply.header('Retry-After', Math.max(cooldownInSeconds, 0).toString(10));
			} else {
				this.logger.warn(`rate limit information has unexpected type ${typeof (err.info?.reset)}`);
			}
		} else if (err.kind === 'client') {
			if (!reply.getHeader('WWW-Authenticate')) {
				reply.header('WWW-Authenticate', `Bearer realm="Misskey", error="invalid_request", error_description="${err.message}"`);
			}
			statusCode = statusCode ?? 400;
		} else if (err.kind === 'permission') {
			// (ROLE_PERMISSION_DENIEDは関係ない)
			if (err.code === 'PERMISSION_DENIED') {
				reply.header('WWW-Authenticate', `Bearer realm="Misskey", error="insufficient_scope", error_description="${err.message}"`);
			}
			statusCode = statusCode ?? 403;
		} else statusCode ??= 500;
		this.send(reply, statusCode, err);
	}

	#sendAuthenticationError(reply: FastifyReply, err: unknown): void {
		if (err instanceof AuthenticationError) {
			const message = 'Authentication failed. Please ensure your token is correct.';
			reply.header('WWW-Authenticate', `Bearer realm="Misskey", error="invalid_token", error_description="${message}"`);
			this.#sendApiError(reply, new ApiError({
				message: 'Authentication failed. Please ensure your token is correct.',
				code: 'AUTHENTICATION_FAILED',
				id: 'b0a7f5f8-dc2f-4171-b91f-de88ad238e14',
				httpStatusCode: 401,
				kind: 'client',
			}));
		} else {
			this.#sendApiError(reply, new ApiError({
				message: 'Internal error occurred. Please contact us if the error persists.',
				code: 'INTERNAL_ERROR',
				id: '5d37dbcb-891e-41ca-a3d6-e690c97775ac',
				kind: 'server',
			}));
		}
	}

	#onExecError(ep: IEndpoint, data: any, err: Error, userId?: MiUser['id']): void {
		if (err instanceof ApiError || err instanceof AuthenticationError) {
			throw err;
		} else if (err instanceof IdentifiableError) {
			this.logger.error(`Internal error occurred in ${ep.name}: ${err.message}`, {
				ep: ep.name,
				ps: data,
				id: err.id,
				error: {
					message: err.message,
					code: 'INTERNAL_ERROR',
					stack: err.stack,
				},
			});
			throw new ApiError(
				{
					message: err.message,
					code: 'INTERNAL_ERROR',
					id: err.id,
				},
				{
					message: err.message,
					code: err.name,
					id: err.id,
				},
			);
		} else {
			const errId = randomUUID();
			this.logger.error(`Internal error occurred in ${ep.name}: ${err.message}`, {
				ep: ep.name,
				ps: data,
				id: errId,
				error: {
					message: err.message,
					code: err.name,
					stack: err.stack,
				},
			});

			if (this.config.sentryForBackend) {
				Sentry.captureMessage(`Internal error occurred in ${ep.name}: ${err.message}`, {
					level: 'error',
					user: {
						id: userId,
					},
					extra: {
						ep: ep.name,
						ps: data,
						id: errId,
						error: {
							message: err.message,
							code: err.name,
							stack: err.stack,
						},
					},
				});
			}

			throw new ApiError(
				{
					message: 'Internal error occurred. Please contact us if the error persists.',
					code: 'INTERNAL_ERROR',
					id: '5d37dbcb-891e-41ca-a3d6-e690c97775ac',
					kind: 'server',
				},
				{
					message: err.message,
					code: err.name,
					id: errId,
				},
			);
		}
	}

	@bindThis
	public handleRequest(
		endpoint: IEndpoint & { exec: any },
		request: FastifyRequest<{ Body: Record<string, unknown> | undefined, Querystring: Record<string, unknown> }>,
		reply: FastifyReply,
	): void {
		const body = request.method === 'GET'
			? request.query
			: request.body;

		// https://datatracker.ietf.org/doc/html/rfc6750.html#section-2.1 (case sensitive)
		const token = request.headers.authorization?.startsWith('Bearer ')
			? request.headers.authorization.slice(7)
			: body?.['i'];
		if (token != null && typeof token !== 'string') {
			reply.code(400);
			return;
		}
		this.authenticateService.authenticate(token).then(([user, app]) => {
			this.call(endpoint, user, app, body, null, request).then((res) => {
				if (request.method === 'GET' && endpoint.meta.cacheSec && !token && !user) {
					reply.header('Cache-Control', `public, max-age=${endpoint.meta.cacheSec}`);
				}
				this.send(reply, res);
			}).catch((err: ApiError) => {
				this.#sendApiError(reply, err);
			});

			if (user) {
				this.logIp(request, user);
			}
		}).catch(err => {
			this.#sendAuthenticationError(reply, err);
		});
	}

	@bindThis
	public async handleMultipartRequest(
		endpoint: IEndpoint & { exec: any },
		request: FastifyRequest<{ Body: Record<string, unknown>, Querystring: Record<string, unknown> }>,
		reply: FastifyReply,
	): Promise<void> {
		if (!request.isMultipart()) {
			this.#sendApiError(reply, new ApiError({
				message: 'Current request is not a multipart request',
				code: 'INVALID_PARAM',
				id: '217bc614-dd72-42dc-806e-22ac93f8266e',
				httpStatusCode: 400,
				kind: 'client',
			}));
			return;
		}

		let preparedFile: PreparedFile | undefined;
		const fields = {} as Record<string, unknown>;

		const parts = request.parts();

		const globalSizeLimitStream = (limit: number) => {
			let total = 0;
			return new Transform({
				transform: (chunk, _enc, callback) => {
					total += chunk.length;
					if (total > limit) {
						callback(new ApiError(uploadFileSizeExceeded));
					} else {
						callback(null, chunk);
					}
				},
			});
		};

		for await (const part of parts) {
			if (part.type === 'file') {
				this.logger.debug('received multipart file', { endpoint: endpoint.name, filename: part.filename });
				if (preparedFile) {
					this.#sendApiError(reply, new ApiError({
						message: 'Only a single file may be uploaded at a time',
						code: 'INVALID_PARAM',
						id: '5c95c8b6-25bf-40e1-8c7d-d6d727d3503b',
						httpStatusCode: 406,
						kind: 'client',
					}));
					return;
				}

				const [path, cleanup] = await createTemp();
				try {
					await stream.pipeline(part.file, globalSizeLimitStream(this.config.maxFileSize), fs.createWriteStream(path));
				} catch (err) {
					cleanup();
					if ((err as { code?: string; })?.code === 'FST_REQ_FILE_TOO_LARGE' || err instanceof ApiError) {
						this.#sendApiError(reply, err instanceof ApiError ? err : new ApiError(uploadFileSizeExceeded));
						return;
					}
					throw err;
				}

				if (part.file.truncated) {
					cleanup();
					this.#sendApiError(reply, new ApiError(uploadFileSizeExceeded));
					return;
				}

				const stats = await fs.promises.stat(path);
				preparedFile = {
					file: {
						name: part.filename ?? null,
						path,
					},
					size: stats.size,
					cleanup,
				};
			} else if (part.type === 'field') {
				fields[part.fieldname] = part.value;
			}
		}

		if (!preparedFile) {
			this.#sendApiError(reply, new ApiError({
				message: 'No files found in multipart request',
				code: 'INVALID_PARAM',
				id: '2e973d41-8e9c-48b8-a68f-16f712a4bc89',
				httpStatusCode: 422,
				kind: 'client',
			}));
			return;
		}

		// https://datatracker.ietf.org/doc/html/rfc6750.html#section-2.1 (case sensitive)
		const token = request.headers.authorization?.startsWith('Bearer ')
			? request.headers.authorization.slice(7)
			: fields['i'];
		if (token != null && typeof token !== 'string') {
			this.#sendApiError(reply, new ApiError({
				message: 'No authorization token was found',
				code: 'AUTHENTICATION_FAILED',
				id: '39591dd6-b5e8-4399-bb03-13b0a8a62a21',
				httpStatusCode: 401,
				kind: 'client',
			}));
			return;
		}

		this.authenticateService.authenticate(token).then(([user, app]) => {
			this.call(endpoint, user, app, fields, preparedFile, request).then((res) => {
				this.send(reply, res);
			}).catch((err: ApiError) => {
				this.#sendApiError(reply, err);
			});

			if (user) {
				this.logIp(request, user);
			}
		}).catch(err => {
			preparedFile.cleanup();
			this.#sendAuthenticationError(reply, err);
		});
	}

	@bindThis
	private send(reply: FastifyReply, x?: any, y?: ApiError) {
		if (x == null) {
			reply.code(204);
			reply.send();
		} else if (typeof x === 'number' && y) {
			reply.code(x);
			reply.send({
				error: {
					message: y!.message,
					code: y!.code,
					id: y!.id,
					kind: y!.kind,
					...(y!.info ? { info: y!.info } : {}),
				},
			});
		} else {
			// 文字列を返す場合は、JSON.stringify通さないとJSONと認識されない
			reply.send(typeof x === 'string' ? JSON.stringify(x) : x);
		}
	}

	@bindThis
	private async logIp(request: FastifyRequest, user: MiLocalUser) {
		const meta = await this.metaService.fetch();
		if (!meta.enableIpLogging) return;
		const ip = request.ip;
		const ips = this.userIpHistories.get(user.id);
		if (ips == null || !ips.has(ip)) {
			if (ips == null) {
				this.userIpHistories.set(user.id, new Set([ip]));
			} else {
				ips.add(ip);
			}

			try {
				this.userIpsRepository.createQueryBuilder().insert().values({
					createdAt: new Date(),
					userId: user.id,
					ip: ip,
				}).orIgnore(true).execute();
			} catch {
			}
		}
	}

	@bindThis
	private async call(
		ep: IEndpoint & { exec: any },
		user: MiLocalUser | null | undefined,
		token: MiAccessToken | null | undefined,
		data: any,
		preparedFile: PreparedFile | null | undefined,
		request: FastifyRequest<{ Body: Record<string, unknown> | undefined, Querystring: Record<string, unknown> }>,
	) {
		const meta = await this.metaService.fetch();
		const isSecure = user != null && token == null;

		if (ep.meta.secure && !isSecure) {
			throw new ApiError(accessDenied);
		}

		const bypassRateLimit = this.config.bypassRateLimit?.some(({
			header,
			value,
		}) => request.headers[header] === value) ?? false;
		if (ep.meta.limit && !bypassRateLimit) {
			// koa will automatically load the `X-Forwarded-For` header if `proxy: true` is configured in the app.
			let limitActor: string;
			if (user) {
				limitActor = user.id;
			} else {
				limitActor = getIpHash(request.ip);
			}

			const limit = Object.assign({}, ep.meta.limit);

			if (limit.key == null) {
				(limit as any).key = ep.name;
			}

			// TODO: 毎リクエスト計算するのもあれだしキャッシュしたい
			const factor = user ? (await this.roleService.getUserPolicies(user.id)).rateLimitFactor : 1;

			if (factor > 0) {
				// Rate limit
				const rateLimit = await this.rateLimiterService.limit(limit as IEndpointMeta['limit'] & { key: NonNullable<string> }, limitActor, factor);
				if (rateLimit != null) {
					throw new ApiError({
						message: 'Rate limit exceeded. Please try again later.',
						code: 'RATE_LIMIT_EXCEEDED',
						id: 'd5826d14-3982-4d2e-8011-b9e9f02499ef',
						httpStatusCode: 429,
					}, rateLimit.info);
				}
			}
		}

		if (ep.meta.requireCredential || ep.meta.requireModerator || ep.meta.requireAdmin) {
			if (user == null) {
				throw new ApiError({
					message: 'Credential required.',
					code: 'CREDENTIAL_REQUIRED',
					id: '1384574d-a912-4b81-8601-c7b1c4085df1',
					httpStatusCode: 401,
				});
			} else if (user!.isSuspended) {
				throw new ApiError({
					message: 'Your account has been suspended.',
					code: 'YOUR_ACCOUNT_SUSPENDED',
					kind: 'permission',
					id: 'a8c724b3-6e9c-4b46-b1a8-bc3ed6258370',
				});
			}
		}

		if (ep.meta.prohibitMoved) {
			if (user?.movedToUri) {
				throw new ApiError({
					message: 'You have moved your account.',
					code: 'YOUR_ACCOUNT_MOVED',
					kind: 'permission',
					id: '56f20ec9-fd06-4fa5-841b-edd6d7d4fa31',
				});
			}
		}

		if (token && ((ep.meta.kind && !token.permission.some(p => p === ep.meta.kind))
			|| (!ep.meta.kind && (ep.meta.requireCredential || ep.meta.requireModerator || ep.meta.requireAdmin)))) {
			throw new ApiError({
				message: 'Your app does not have the necessary permissions to use this endpoint.',
				code: 'PERMISSION_DENIED',
				kind: 'permission',
				id: '1370e5b7-d4eb-4566-bb1d-7748ee6a1838',
			});
		}

		if ((ep.meta.requireModerator || ep.meta.requireAdmin) && (meta.rootUserId !== user!.id)) {
			const myRoles = await this.roleService.getUserRoles(user!.id);
			if (ep.meta.requireModerator && !myRoles.some(r => r.isModerator || r.isAdministrator)) {
				throw new ApiError({
					message: 'You are not assigned to a moderator role.',
					code: 'ROLE_PERMISSION_DENIED',
					kind: 'permission',
					id: 'd33d5333-db36-423d-a8f9-1a2b9549da41',
				});
			}
			if (ep.meta.requireAdmin && !myRoles.some(r => r.isAdministrator)) {
				throw new ApiError({
					message: 'You are not assigned to an administrator role.',
					code: 'ROLE_PERMISSION_DENIED',
					kind: 'permission',
					id: 'c3d38592-54c0-429d-be96-5636b0431a61',
				});
			}
		}

		if (ep.meta.requiredRolePolicy != null && (meta.rootUserId !== user!.id)) {
			const myRoles = await this.roleService.getUserRoles(user!.id);
			const policies = await this.roleService.getUserPolicies(user!.id);
			if (!policies[ep.meta.requiredRolePolicy] && !myRoles.some(r => r.isAdministrator)) {
				throw new ApiError({
					message: 'You are not assigned to a required role.',
					code: 'ROLE_PERMISSION_DENIED',
					kind: 'permission',
					id: '7f86f06f-7e15-4057-8561-f4b6d4ac755a',
				});
			}
		}

		// Cast non JSON input
		if ((ep.meta.requireFile || request.method === 'GET') && ep.params.properties) {
			for (const k of Object.keys(ep.params.properties)) {
				const param = ep.params.properties![k];
				if (['boolean', 'number', 'integer'].includes(param.type ?? '') && typeof data[k] === 'string') {
					try {
						data[k] = JSON.parse(data[k]);
					} catch {
						throw new ApiError({
							message: 'Invalid param.',
							code: 'INVALID_PARAM',
							id: '0b5f1631-7c1a-41a6-b399-cce335f34d85',
						}, {
							param: k,
							reason: `cannot cast to ${param.type}`,
						});
					}
				}
			}
		}

		let attachmentFile: AttachmentFile | null = null;
		let onExecCleanup: (() => void) | undefined = undefined;
		if (ep.meta.requireFile && preparedFile) {
			const policies = await this.roleService.getUserPolicies(user!.id);
			const userMaxFileSize = policies.maxFileSizeMb * 1024 * 1024;

			if (preparedFile.size > userMaxFileSize) {
				preparedFile.cleanup();
				throw new ApiError(uploadFileSizeExceeded);
			}

			attachmentFile = preparedFile.file;
			onExecCleanup = () => preparedFile.cleanup();
		}

		// API invoking
		if (this.config.sentryForBackend) {
			return await Sentry.startSpan({
				name: 'API: ' + ep.name,
			}, () => ep.exec(data, user, token, attachmentFile, request.ip, request.headers)
				.catch((err: Error) => this.#onExecError(ep, data, err, user?.id))
				.finally(() => onExecCleanup?.()));
		} else {
			return await ep.exec(data, user, token, attachmentFile, request.ip, request.headers)
				.catch((err: Error) => this.#onExecError(ep, data, err, user?.id))
				.finally(() => onExecCleanup?.());
		}
	}

	@bindThis
	public dispose(): void {
		clearInterval(this.userIpHistoriesClearIntervalId);
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
