/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// https://github.com/typeorm/typeorm/issues/2400
import pg from 'pg';

import { DataSource, Logger,type QueryRunner } from 'typeorm';
import { QueryResultCache } from 'typeorm/cache/QueryResultCache.js';
import { QueryResultCacheOptions } from 'typeorm/cache/QueryResultCacheOptions.js';
import * as highlight from 'cli-highlight';
import { entities as charts } from '@/core/chart/entities.js';
import { MiAbuseReportResolver } from '@/models/AbuseReportResolver.js';
import { MiAbuseUserReport } from '@/models/AbuseUserReport.js';
import { MiAbuseReportNotificationRecipient } from '@/models/AbuseReportNotificationRecipient.js';
import { MiAccessToken } from '@/models/AccessToken.js';
import { MiAd } from '@/models/Ad.js';
import { MiAnnouncement } from '@/models/Announcement.js';
import { MiAnnouncementRead } from '@/models/AnnouncementRead.js';
import { MiAntenna } from '@/models/Antenna.js';
import { MiApp } from '@/models/App.js';
import { MiAvatarDecoration } from '@/models/AvatarDecoration.js';
import { MiAuthSession } from '@/models/AuthSession.js';
import { MiBlocking } from '@/models/Blocking.js';
import { MiChannelFollowing } from '@/models/ChannelFollowing.js';
import { MiChannelFavorite } from '@/models/ChannelFavorite.js';
import { MiClip } from '@/models/Clip.js';
import { MiClipNote } from '@/models/ClipNote.js';
import { MiClipFavorite } from '@/models/ClipFavorite.js';
import { MiDriveFile } from '@/models/DriveFile.js';
import { MiDriveFolder } from '@/models/DriveFolder.js';
import { MiEmoji } from '@/models/Emoji.js';
import { MiFollowing } from '@/models/Following.js';
import { MiFollowRequest } from '@/models/FollowRequest.js';
import { MiGalleryLike } from '@/models/GalleryLike.js';
import { MiGalleryPost } from '@/models/GalleryPost.js';
import { MiHashtag } from '@/models/Hashtag.js';
import { MiIndieAuthClient } from '@/models/IndieAuthClient.js';
import { MiInstance } from '@/models/Instance.js';
import { MiMeta } from '@/models/Meta.js';
import { MiModerationLog } from '@/models/ModerationLog.js';
import { MiMuting } from '@/models/Muting.js';
import { MiRenoteMuting } from '@/models/RenoteMuting.js';
import { MiNote } from '@/models/Note.js';
import { MiScheduledNote } from '@/models/ScheduledNote.js';
import { MiNoteFavorite } from '@/models/NoteFavorite.js';
import { MiNoteReaction } from '@/models/NoteReaction.js';
import { MiNoteThreadMuting } from '@/models/NoteThreadMuting.js';
import { MiPage } from '@/models/Page.js';
import { MiPageLike } from '@/models/PageLike.js';
import { MiPasswordResetRequest } from '@/models/PasswordResetRequest.js';
import { MiPoll } from '@/models/Poll.js';
import { MiPollVote } from '@/models/PollVote.js';
import { MiPromoNote } from '@/models/PromoNote.js';
import { MiPromoRead } from '@/models/PromoRead.js';
import { MiRegistrationTicket } from '@/models/RegistrationTicket.js';
import { MiRegistryItem } from '@/models/RegistryItem.js';
import { MiRelay } from '@/models/Relay.js';
import { MiSignin } from '@/models/Signin.js';
import { MiSingleSignOnServiceProvider } from '@/models/SingleSignOnServiceProvider.js';
import { MiSwSubscription } from '@/models/SwSubscription.js';
import { MiUsedUsername } from '@/models/UsedUsername.js';
import { MiUser } from '@/models/User.js';
import { MiUserIp } from '@/models/UserIp.js';
import { MiUserKeypair } from '@/models/UserKeypair.js';
import { MiUserList } from '@/models/UserList.js';
import { MiUserListFavorite } from '@/models/UserListFavorite.js';
import { MiUserListMembership } from '@/models/UserListMembership.js';
import { MiUserNotePining } from '@/models/UserNotePining.js';
import { MiUserPending } from '@/models/UserPending.js';
import { MiUserProfile } from '@/models/UserProfile.js';
import { MiUserPublickey } from '@/models/UserPublickey.js';
import { MiUserSecurityKey } from '@/models/UserSecurityKey.js';
import { MiUserAccountMoveLog } from '@/models/UserAccountMoveLog.js';
import { MiWebhook } from '@/models/Webhook.js';
import { MiSystemWebhook } from '@/models/SystemWebhook.js';
import { MiChannel } from '@/models/Channel.js';
import { MiRetentionAggregation } from '@/models/RetentionAggregation.js';
import { MiRole } from '@/models/Role.js';
import { MiRoleAssignment } from '@/models/RoleAssignment.js';
import { MiFlash } from '@/models/Flash.js';
import { MiFlashLike } from '@/models/FlashLike.js';
import { MiUserMemo } from '@/models/UserMemo.js';
import { MiChatMessage } from '@/models/ChatMessage.js';
import { MiChatRoom } from '@/models/ChatRoom.js';
import { MiChatRoomMembership } from '@/models/ChatRoomMembership.js';
import { MiChatRoomInvitation } from '@/models/ChatRoomInvitation.js';
import { MiBubbleGameRecord } from '@/models/BubbleGameRecord.js';
import { MiReversiGame } from '@/models/ReversiGame.js';
import { MiChatApproval } from '@/models/ChatApproval.js';
import { MiSystemAccount } from '@/models/SystemAccount.js';

import { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';
import MisskeyLogger from '@/logger.js';
import { envOption } from './env.js';

pg.types.setTypeParser(20, Number);

export const dbLogger = new MisskeyLogger('db');

const sqlLogger = dbLogger.createSubLogger('sql', 'gray', false);

export type LoggerProps = {
	disableQueryTruncation?: boolean;
	enableQueryParamLogging?: boolean;
	printReplicationMode?: boolean,
};

function highlightSql(sql: string) {
	return highlight.highlight(sql, {
		language: 'sql', ignoreIllegals: true,
	});
}

function truncateSql(sql: string) {
	return sql.length > 100 ? `${sql.substring(0, 100)}...` : sql;
}

function stringifyParameter(param: any) {
	if (param instanceof Date) {
		return param.toISOString();
	} else {
		return param;
	}
}

class MyCustomLogger implements Logger {
	constructor(private props: LoggerProps = {}) {
	}

	@bindThis
	private transformQueryLog(sql: string, opts?: {
		prefix?: string;
	}) {
		let modded = opts?.prefix ? opts.prefix + sql : sql;
		if (!this.props.disableQueryTruncation) {
			modded = truncateSql(modded);
		}

		if (envOption.logJson) return sql;

		return highlightSql(modded);
	}

	@bindThis
	private transformParameters(parameters?: any[]) {
		if (this.props.enableQueryParamLogging && parameters && parameters.length > 0) {
			return parameters.map(stringifyParameter);
		}

		return undefined;
	}

	@bindThis
	public logQuery(query: string, parameters?: any[]) {
		sqlLogger.debug(this.transformQueryLog(query));
	}

	@bindThis
	public logQueryError(error: string, query: string, parameters?: any[], queryRunner?: QueryRunner) {
		const prefix = (this.props.printReplicationMode && queryRunner)
			? `[${queryRunner.getReplicationMode()}] `
			: undefined;
		sqlLogger.error(this.transformQueryLog(query, { prefix }), this.transformParameters(parameters));
	}

	@bindThis
	public logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
		const prefix = (this.props.printReplicationMode && queryRunner)
			? `[${queryRunner.getReplicationMode()}] `
			: undefined;
		sqlLogger.warn(this.transformQueryLog(query, { prefix }), this.transformParameters(parameters));
	}

	@bindThis
	public logSchemaBuild(message: string) {
		sqlLogger.info(message);
	}

	@bindThis
	public log(message: string) {
		sqlLogger.info(message);
	}

	@bindThis
	public logMigration(message: string) {
		sqlLogger.info(message);
	}
}

export const entities = [
	MiAbuseReportResolver,
	MiAnnouncement,
	MiAnnouncementRead,
	MiMeta,
	MiInstance,
	MiApp,
	MiAvatarDecoration,
	MiAuthSession,
	MiAccessToken,
	MiUser,
	MiUserProfile,
	MiUserKeypair,
	MiUserPublickey,
	MiUserList,
	MiUserListFavorite,
	MiUserListMembership,
	MiUserNotePining,
	MiUserSecurityKey,
	MiUserAccountMoveLog,
	MiUsedUsername,
	MiFollowing,
	MiFollowRequest,
	MiMuting,
	MiRenoteMuting,
	MiBlocking,
	MiNote,
	MiScheduledNote,
	MiNoteFavorite,
	MiNoteReaction,
	MiNoteThreadMuting,
	MiPage,
	MiPageLike,
	MiGalleryPost,
	MiGalleryLike,
	MiDriveFile,
	MiDriveFolder,
	MiPoll,
	MiPollVote,
	MiEmoji,
	MiHashtag,
	MiIndieAuthClient,
	MiSwSubscription,
	MiSystemAccount,
	MiAbuseUserReport,
	MiAbuseReportNotificationRecipient,
	MiRegistrationTicket,
	MiSignin,
	MiSingleSignOnServiceProvider,
	MiModerationLog,
	MiClip,
	MiClipNote,
	MiClipFavorite,
	MiAntenna,
	MiPromoNote,
	MiPromoRead,
	MiRelay,
	MiChannel,
	MiChannelFollowing,
	MiChannelFavorite,
	MiRegistryItem,
	MiAd,
	MiPasswordResetRequest,
	MiUserPending,
	MiWebhook,
	MiSystemWebhook,
	MiUserIp,
	MiRetentionAggregation,
	MiRole,
	MiRoleAssignment,
	MiFlash,
	MiFlashLike,
	MiUserMemo,
	MiChatMessage,
	MiChatRoom,
	MiChatRoomMembership,
	MiChatRoomInvitation,
	MiChatApproval,
	MiBubbleGameRecord,
	MiReversiGame,
	...charts,
];

const log = process.env.NODE_ENV !== 'production';
const timeoutFinalizationRegistry = new FinalizationRegistry((reference: { name: string; timeout: NodeJS.Timeout }) => {
	dbLogger.info(`Finalizing timeout: ${reference.name}`);
	clearInterval(reference.timeout);
});

class InMemoryQueryResultCache implements QueryResultCache {
	private cache: Map<string, QueryResultCacheOptions>;

	constructor(
		private dataSource: DataSource,
	) {
		this.cache = new Map();

		const gcIntervalHandle = setInterval(() => {
			this.gc();
		}, 1000 * 60 * 3);

		timeoutFinalizationRegistry.register(this, { name: typeof this, timeout: gcIntervalHandle });
	}

	connect(): Promise<void> {
		return Promise.resolve(undefined);
	}

	disconnect(): Promise<void> {
		return Promise.resolve(undefined);
	}

	synchronize(queryRunner: QueryRunner): Promise<void> {
		return Promise.resolve(undefined);
	}

	async clear(queryRunner?: QueryRunner): Promise<void> {
		return new Promise<void>((ok) => {
			this.cache.clear();
			ok();
		});
	}

	storeInCache(
		options: QueryResultCacheOptions,
		savedCache: QueryResultCacheOptions | undefined,
		queryRunner?: QueryRunner,
	): Promise<void> {
		return new Promise<void>((ok, fail) => {
			if (options.identifier) {
				this.cache.set(options.identifier, options);
				ok();
			} else if (options.query) {
				this.cache.set(options.query, options);
				ok();
			}
			fail(new Error('No identifier or query'));
		});
	}

	getFromCache(
		options: QueryResultCacheOptions,
		queryRunner?: QueryRunner,
	): Promise<QueryResultCacheOptions | undefined> {
		return new Promise<QueryResultCacheOptions | undefined>((ok) => {
			if (options.identifier) {
				ok(this.cache.get(options.identifier));
			} else if (options.query) {
				ok(this.cache.get(options.query));
			} else {
				ok(undefined);
			}
		});
	}

	isExpired(savedCache: QueryResultCacheOptions): boolean {
		return (savedCache.time ?? 0) + savedCache.duration < Date.now();
	}

	remove(identifiers: string[], queryRunner?: QueryRunner): Promise<void> {
		return new Promise<void>((ok) => {
			for (const identifier of identifiers) {
				this.cache.delete(identifier);
			}
			ok();
		});
	}

	gc(): void {
		const now = Date.now();
		for (const [key, { time, duration }] of this.cache.entries()) {
			if ((time ?? 0) + duration < now) {
				this.cache.delete(key);
			}
		}
	}
}

export function createPostgresDataSource(config: Config) {
	return new DataSource({
		type: 'postgres',
		host: config.db.host,
		port: config.db.port,
		username: config.db.user,
		password: config.db.pass,
		database: config.db.db,
		extra: {
			statement_timeout: 1000 * 10,
			...config.db.extra,
		},
		...(config.dbReplications ? {
			replication: {
				master: {
					host: config.db.host,
					port: config.db.port,
					username: config.db.user,
					password: config.db.pass,
					database: config.db.db,
				},
				slaves: config.dbSlaves!.map(rep => ({
					host: rep.host,
					port: rep.port,
					username: rep.user,
					password: rep.pass,
					database: rep.db,
				})),
			},
		} : {}),
		synchronize: process.env.NODE_ENV === 'test',
		dropSchema: process.env.NODE_ENV === 'test',
		cache: !config.db.disableCache && process.env.NODE_ENV !== 'test' ? {
			provider(dataSource) {
				return new InMemoryQueryResultCache(dataSource);
			},
		} : false,
		logging: log,
		logger: log
			? new MyCustomLogger({
				disableQueryTruncation: config.logging?.sql?.disableQueryTruncation,
				enableQueryParamLogging: config.logging?.sql?.enableQueryParamLogging,
				printReplicationMode: !!config.dbReplications,
			})
			: undefined,
		maxQueryExecutionTime: 10000, // 10s
		entities: entities,
		migrations: ['../../migration/*.js'],
	});
}
