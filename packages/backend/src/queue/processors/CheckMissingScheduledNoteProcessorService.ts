import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { NoteDraftsRepository, ScheduledNotesRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { acquireDistributedLock } from '@/misc/distributed-lock.js';
import { getPostScheduledNoteJobId, QueueService } from '@/core/QueueService.js';
import { LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL } from '@/models/ScheduledNote.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class CheckMissingScheduledNoteProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.redisForTimelines)
		private redisForTimelines: Redis.Redis,

		@Inject(DI.scheduledNotesRepository)
		private scheduledNotesRepository: ScheduledNotesRepository,

		@Inject(DI.noteDraftsRepository)
		private noteDraftsRepository: NoteDraftsRepository,

		private queueService: QueueService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('note:scheduled');
	}

	@bindThis
	public async process(): Promise<void> {
		this.logger.info('checking missing scheduled note tasks');

		let release: (() => Promise<void>) | undefined;
		try {
			release = await acquireDistributedLock(this.redisForTimelines, 'note:scheduled:check', 3 * 60 * 1000, 1, 1000);
		} catch {
			this.logger.warn('check is already being processed');
			return;
		}

		try {
			await this.recoverLegacySchedules();
			await this.recoverNoteDraftSchedules();
		} finally {
			await release();
		}
	}

	private async recoverLegacySchedules(): Promise<void> {
		let lastId = '0';
		while (true) {
			const drafts = await this.scheduledNotesRepository.createQueryBuilder('draft')
				.where('draft.scheduledAt < now() + interval \'10 minutes\'')
				.andWhere('draft.scheduledAt IS NOT NULL')
				.andWhere('draft.reason IS NULL')
				.andWhere(LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL)
				.andWhere('draft.id > :lastId', { lastId })
				.orderBy('draft.id', 'ASC')
				.limit(100)
				.getMany();
			if (drafts.length === 0) break;

			for (const draft of drafts) {
				const jobState = await this.queueService.systemQueue.getJobState(`scheduledNote-${draft.id}`);
				if (jobState !== 'unknown') continue;

				this.logger.warn(`found missing scheduled note task: ${draft.id}`);
				await this.queueService.createScheduledNoteJob(draft.id, draft.scheduledAt!);
			}

			lastId = drafts[drafts.length - 1].id;
		}
	}

	private async recoverNoteDraftSchedules(): Promise<void> {
		let lastScheduledAt: Date | null = null;
		let lastId = '0';
		while (true) {
			const query = this.noteDraftsRepository.createQueryBuilder('draft')
				.where('draft.scheduledAt < now() + interval \'10 minutes\'')
				.andWhere('draft.scheduledAt IS NOT NULL')
				.andWhere('draft.isActuallyScheduled = true')
				.andWhere('draft.scheduledFailureReason IS NULL');
			if (lastScheduledAt != null) {
				query.andWhere('(draft.scheduledAt > :lastScheduledAt OR (draft.scheduledAt = :lastScheduledAt AND draft.id > :lastId))', {
					lastScheduledAt,
					lastId,
				});
			}
			const drafts = await query
				.orderBy('draft.scheduledAt', 'ASC')
				.addOrderBy('draft.id', 'ASC')
				.limit(100)
				.getMany();
			if (drafts.length === 0) break;

			for (const draft of drafts) {
				const jobId = getPostScheduledNoteJobId(draft.id, draft.scheduledAt!);
				const jobState = await this.queueService.postScheduledNoteQueue.getJobState(jobId);
				if (jobState === 'failed') {
					await this.queueService.postScheduledNoteQueue.remove(jobId);
				} else if (jobState !== 'unknown') {
					continue;
				}

				this.logger.warn(`found missing note draft task: ${draft.id}`);
				await this.queueService.createPostScheduledNoteJob(draft.id, draft.scheduledAt!);
			}

			lastScheduledAt = drafts[drafts.length - 1].scheduledAt;
			lastId = drafts[drafts.length - 1].id;
		}
	}
}
