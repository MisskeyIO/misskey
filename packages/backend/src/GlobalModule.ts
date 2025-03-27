/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import process from 'node:process';
import { Global, Inject, Module } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { MeiliSearch } from 'meilisearch';
import { Client as ElasticSearch } from '@elastic/elasticsearch';
import { MiMeta } from '@/models/Meta.js';
import { DI } from './di-symbols.js';
import { Config, loadConfig } from './config.js';
import { createPostgresDataSource } from './postgres.js';
import { RepositoryModule } from './models/RepositoryModule.js';
import { allSettled } from './misc/promise-tracker.js';
import { GlobalEvents } from './core/GlobalEventService.js';
import type { Provider, OnApplicationShutdown } from '@nestjs/common';

const $config: Provider = {
	provide: DI.config,
	useValue: loadConfig(),
};

const $db: Provider = {
	provide: DI.db,
	useFactory: async (config) => {
		const db = createPostgresDataSource(config);
		return await db.initialize();
	},
	inject: [DI.config],
};

const $meilisearch: Provider = {
	provide: DI.meilisearch,
	useFactory: (config: Config) => {
		if (config.meilisearch) {
			return new MeiliSearch({
				host: `${config.meilisearch.ssl ? 'https' : 'http'}://${config.meilisearch.host}:${config.meilisearch.port}`,
				apiKey: config.meilisearch.apiKey,
			});
		} else {
			return null;
		}
	},
	inject: [DI.config],
};

const $elasticsearch: Provider = {
	provide: DI.elasticsearch,
	useFactory: (config: Config) => {
		if (config.elasticsearch) {
			return new ElasticSearch({
				nodes: {
					url: new URL(`${config.elasticsearch.ssl ? 'https' : 'http'}://${config.elasticsearch.host}:${config.elasticsearch.port}`),
					ssl: {
						rejectUnauthorized: config.elasticsearch.rejectUnauthorized,
					},
				},
				auth: (config.elasticsearch.user && config.elasticsearch.pass) ? {
					username: config.elasticsearch.user,
					password: config.elasticsearch.pass,
				} : undefined,
				pingTimeout: 30000,
			});
		} else {
			return null;
		}
	},
	inject: [DI.config],
};

const $redis: Provider = {
	provide: DI.redis,
	useFactory: (config: Config) => {
		const redis = new Redis.Redis({
			...config.redis,
			reconnectOnError: (err: Error) => {
				if ( err.message.includes('READONLY')
					|| err.message.includes('ETIMEDOUT')
					|| err.message.includes('Command timed out')
				) return 2;
				return 1;
			},
		});
		redis.defineCommand('setIf', {
			numberOfKeys: 1,
			lua: `
				if redis.call('GET', KEYS[1]) == ARGV[1] then
					return redis.call('SET', KEYS[1], ARGV[2])
				else
					return 0
				end
			`,
		});
		redis.defineCommand('unlinkIf', {
			numberOfKeys: 1,
			lua: `
				if redis.call('GET', KEYS[1]) == ARGV[1] then
					return redis.call('UNLINK', KEYS[1])
				else
					return 0
				end
			`,
		});
		return redis;
	},
	inject: [DI.config],
};

const $redisForPub: Provider = {
	provide: DI.redisForPub,
	useFactory: (config: Config) => {
		const redis = new Redis.Redis({
			...config.redisForPubsub,
			reconnectOnError: (err: Error) => {
				if ( err.message.includes('READONLY')
					|| err.message.includes('ETIMEDOUT')
					|| err.message.includes('Command timed out')
				) return 2;
				return 1;
			},
		});
		return redis;
	},
	inject: [DI.config],
};

const $redisForSub: Provider = {
	provide: DI.redisForSub,
	useFactory: (config: Config) => {
		const redis = new Redis.Redis({
			...config.redisForPubsub,
			reconnectOnError: (err: Error) => {
				if ( err.message.includes('READONLY')
					|| err.message.includes('ETIMEDOUT')
					|| err.message.includes('Command timed out')
				) return 2;
				return 1;
			},
		});
		redis.subscribe(config.host);
		return redis;
	},
	inject: [DI.config],
};

const $redisForTimelines: Provider = {
	provide: DI.redisForTimelines,
	useFactory: (config: Config) => {
		const redis = new Redis.Redis({
			...config.redisForTimelines,
			reconnectOnError: (err: Error) => {
				if ( err.message.includes('READONLY')
					|| err.message.includes('ETIMEDOUT')
					|| err.message.includes('Command timed out')
				) return 2;
				return 1;
			},
		});
		redis.defineCommand('setIf', {
			numberOfKeys: 1,
			lua: `
				if redis.call('GET', KEYS[1]) == ARGV[1] then
					return redis.call('SET', KEYS[1], ARGV[2])
				else
					return 0
				end
			`,
		});
		redis.defineCommand('unlinkIf', {
			numberOfKeys: 1,
			lua: `
				if redis.call('GET', KEYS[1]) == ARGV[1] then
					return redis.call('UNLINK', KEYS[1])
				else
					return 0
				end
			`,
		});
		return redis;
	},
	inject: [DI.config],
};

const $redisForReactions: Provider = {
	provide: DI.redisForReactions,
	useFactory: (config: Config) => {
		const redis = new Redis.Redis({
			...config.redisForReactions,
			reconnectOnError: (err: Error) => {
				if ( err.message.includes('READONLY')
					|| err.message.includes('ETIMEDOUT')
					|| err.message.includes('Command timed out')
				) return 2;
				return 1;
			},
		});
		redis.defineCommand('setIf', {
			numberOfKeys: 1,
			lua: `
				if redis.call('GET', KEYS[1]) == ARGV[1] then
					return redis.call('SET', KEYS[1], ARGV[2])
				else
					return 0
				end
			`,
		});
		redis.defineCommand('unlinkIf', {
			numberOfKeys: 1,
			lua: `
				if redis.call('GET', KEYS[1]) == ARGV[1] then
					return redis.call('UNLINK', KEYS[1])
				else
					return 0
				end
			`,
		});
		return redis;
	},
	inject: [DI.config],
};

const $meta: Provider = {
	provide: DI.meta,
	useFactory: async (db: DataSource, redisForSub: Redis.Redis) => {
		const meta = await db.transaction(async transactionalEntityManager => {
			// 過去のバグでレコードが複数出来てしまっている可能性があるので新しいIDを優先する
			const metas = await transactionalEntityManager.find(MiMeta, {
				order: {
					id: 'DESC',
				},
			});

			const meta = metas[0];

			if (meta) {
				return meta;
			} else {
				// metaが空のときfetchMetaが同時に呼ばれるとここが同時に呼ばれてしまうことがあるのでフェイルセーフなupsertを使う
				const saved = await transactionalEntityManager
					.upsert(
						MiMeta,
						{
							id: 'x',
						},
						['id'],
					)
					.then((x) => transactionalEntityManager.findOneByOrFail(MiMeta, x.identifiers[0]));

				return saved;
			}
		});

		async function onMessage(_: string, data: string): Promise<void> {
			const obj = JSON.parse(data);

			if (obj.channel === 'internal') {
				const { type, body } = obj.message as GlobalEvents['internal']['payload'];
				switch (type) {
					case 'metaUpdated': {
						for (const key in body.after) {
							(meta as any)[key] = (body.after as any)[key];
						}
						meta.proxyAccount = null; // joinなカラムは通常取ってこないので
						break;
					}
					default:
						break;
				}
			}
		}

		redisForSub.on('message', onMessage);

		return meta;
	},
	inject: [DI.db, DI.redisForSub],
};

@Global()
@Module({
	imports: [RepositoryModule],
	providers: [$config, $db, $meta, $meilisearch, $elasticsearch, $redis, $redisForPub, $redisForSub, $redisForTimelines, $redisForReactions],
	exports: [$config, $db, $meta, $meilisearch, $elasticsearch, $redis, $redisForPub, $redisForSub, $redisForTimelines, $redisForReactions, RepositoryModule],
})
export class GlobalModule implements OnApplicationShutdown {
	constructor(
		@Inject(DI.db) private db: DataSource,
		@Inject(DI.redis) private redisClient: Redis.Redis,
		@Inject(DI.redisForPub) private redisForPub: Redis.Redis,
		@Inject(DI.redisForSub) private redisForSub: Redis.Redis,
		@Inject(DI.redisForTimelines) private redisForTimelines: Redis.Redis,
		@Inject(DI.redisForReactions) private redisForReactions: Redis.Redis,
	) { }

	public async dispose(): Promise<void> {
		// Wait for all potential DB queries
		await allSettled();
		// And then disconnect from DB
		await Promise.all([
			this.db.destroy(),
			this.redisClient.disconnect(),
			this.redisForPub.disconnect(),
			this.redisForSub.disconnect(),
			this.redisForTimelines.disconnect(),
			this.redisForReactions.disconnect(),
		]);
	}

	async onApplicationShutdown(signal: string): Promise<void> {
		await this.dispose();
		process.emitWarning('Misskey is shutting down', {
			code: 'MISSKEY_SHUTDOWN',
			detail: `Application received ${signal} signal`,
		});
	}
}
