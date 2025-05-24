/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Not, IsNull, Brackets, DataSource, EntityManager } from 'typeorm';
import { bindThis } from '@/decorators.js';
import { DI } from '@/di-symbols.js';
import type Logger from '@/logger.js';
import type { MiUser } from '@/models/User.js';
import type { FollowingsRepository, FollowRequestsRepository, UsersRepository } from '@/models/_.js';
import { QueueService } from '@/core/QueueService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { RelationshipJobData } from '@/queue/types.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';

@Injectable()
export class UserSuspendService {
	public logger: Logger;

	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private userEntityService: UserEntityService,
		private queueService: QueueService,
		private globalEventService: GlobalEventService,
		private apRendererService: ApRendererService,
		private moderationLogService: ModerationLogService,
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('account:suspend');
	}

	@bindThis
	public async suspend(user: MiUser, moderator: MiUser): Promise<void> {
		await this.usersRepository.update(user.id, {
			isSuspended: true,
		});

		this.moderationLogService.log(moderator, 'suspend', {
			userId: user.id,
			userUsername: user.username,
			userHost: user.host,
		});

		(async () => {
			await this.doPostSuspend(user).catch(e => {});
			await this.unFollowAll(user).catch(e => {});
		})();
	}

	@bindThis
	public async unsuspend(user: MiUser, moderator: MiUser): Promise<void> {
		await this.usersRepository.update(user.id, {
			isSuspended: false,
		});

		this.moderationLogService.log(moderator, 'unsuspend', {
			userId: user.id,
			userUsername: user.username,
			userHost: user.host,
		});

		(async () => {
			await this.postUnsuspend(user).catch(e => {});
		})();
	}

	@bindThis
	async doPostSuspend(user: { id: MiUser['id']; host: MiUser['host'] }): Promise<void> {
		this.logger.warn(`doPostSuspend: ${user.id} (host: ${user.host})`);
		this.globalEventService.publishInternalEvent('userChangeSuspendedState', { id: user.id, isSuspended: true });

		await this.queueService.createUserSuspendJob(user);

		if (this.userEntityService.isLocalUser(user)) {
			// 知り得る全SharedInboxにDelete配信
			const content = this.apRendererService.addContext(this.apRendererService.renderDelete(this.userEntityService.genLocalUserUri(user.id), user));

			this.logger.info(`Delivering delete activity to all shared inboxes of ${user.id}`);
			await this.db.transaction(async (transactionalEntityManager: EntityManager) => {
				const inboxesCte = transactionalEntityManager.createQueryBuilder()
					.select('distinct coalesce(following.followerSharedInbox, following.followeeSharedInbox)', 'inbox')
					.from(this.followingsRepository.metadata.targetName, 'following')
					.where(new Brackets((qb) => qb.where({ followerHost: Not(IsNull()) }).orWhere({ followeeHost: Not(IsNull()) })))
					.andWhere(new Brackets((qb) => qb.where({ followerSharedInbox: Not(IsNull()) }).orWhere({ followeeSharedInbox: Not(IsNull()) })))
					.orderBy('inbox');

				let offset = 0;
				let cursor = '';
				while (true) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
					const inboxes = await transactionalEntityManager.createQueryBuilder().addCommonTableExpression(inboxesCte, 'inboxes')
						.select('inbox').from('inboxes', 'inboxes').where('inbox > :cursor', { cursor }).limit(500).getRawMany<{ inbox: string }>()
						.then((rows) => rows.map((row) => row.inbox));

					if (inboxes.length === 0) break;

					this.logger.info(`Delivering delete activity to ${offset} - ${offset + inboxes.length} shared inboxes of ${user.id}`);
					for (const inbox of inboxes) {
						try {
							this.queueService.deliver(user, content, inbox, true);
						} catch (err) {
							this.logger.error(`Failed to deliver delete activity to ${inbox}: ${err}`, { error: err, inbox });
						}
					}

					offset += inboxes.length;
					cursor = inboxes[inboxes.length - 1];
				}
			});

			this.logger.info(`Scheduled delete activity delivery to all shared inboxes of ${user.id}`);
		}
	}

	@bindThis
	private async postUnsuspend(user: MiUser): Promise<void> {
		this.logger.warn(`doPostUnsuspend: ${user.id}`);
		this.globalEventService.publishInternalEvent('userChangeSuspendedState', { id: user.id, isSuspended: false });

		if (this.userEntityService.isLocalUser(user)) {
			// 知り得る全SharedInboxにUndo Delete配信
			const content = this.apRendererService.addContext(this.apRendererService.renderUndo(this.apRendererService.renderDelete(this.userEntityService.genLocalUserUri(user.id), user), user));

			this.logger.info(`Delivering undo delete activity to all shared inboxes of ${user.id}`);
			await this.db.transaction(async (transactionalEntityManager: EntityManager) => {
				const inboxesCte = transactionalEntityManager.createQueryBuilder()
					.select('distinct coalesce(following.followerSharedInbox, following.followeeSharedInbox)', 'inbox')
					.from(this.followingsRepository.metadata.targetName, 'following')
					.where(new Brackets((qb) => qb.where({ followerHost: Not(IsNull()) }).orWhere({ followeeHost: Not(IsNull()) })))
					.andWhere(new Brackets((qb) => qb.where({ followerSharedInbox: Not(IsNull()) }).orWhere({ followeeSharedInbox: Not(IsNull()) })))
					.orderBy('inbox');

				let offset = 0;
				let cursor = '';
				while (true) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
					const inboxes = await transactionalEntityManager.createQueryBuilder().addCommonTableExpression(inboxesCte, 'inboxes')
						.select('inbox').from('inboxes', 'inboxes').where('inbox > :cursor', { cursor }).limit(500).getRawMany<{ inbox: string }>()
						.then((rows) => rows.map((row) => row.inbox));

					if (inboxes.length === 0) break;

					this.logger.info(`Delivering undo delete activity to ${offset} - ${offset + inboxes.length} shared inboxes of ${user.id}`);
					for (const inbox of inboxes) {
						try {
							this.queueService.deliver(user, content, inbox, true);
						} catch (err) {
							this.logger.error(`Failed to deliver undo delete activity to ${inbox}: ${err}`, { error: err, inbox });
						}
					}

					offset += inboxes.length;
					cursor = inboxes[inboxes.length - 1];
				}
			});

			this.logger.info(`Scheduled undo delete activity delivery to all shared inboxes of ${user.id}`);
		}
	}

	@bindThis
	private async unFollowAll(follower: MiUser) {
		const followings = await this.followingsRepository.find({
			where: {
				followerId: follower.id,
				followeeId: Not(IsNull()),
			},
		});

		const jobs: RelationshipJobData[] = [];
		for (const following of followings) {
			if (following.followeeId && following.followerId) {
				jobs.push({
					from: { id: following.followerId },
					to: { id: following.followeeId },
					silent: true,
				});
			}
		}
		this.queueService.createUnfollowJob(jobs);
	}
}
