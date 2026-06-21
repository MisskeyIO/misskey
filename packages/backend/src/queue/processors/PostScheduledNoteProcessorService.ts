/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { NoteDraftsRepository, ScheduledNotesRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { NotificationService } from '@/core/NotificationService.js';
import { bindThis } from '@/decorators.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { PostScheduledNoteJobData } from '../types.js';

@Injectable()
export class PostScheduledNoteProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.scheduledNotesRepository)
		private scheduledNotesRepository: ScheduledNotesRepository,

		@Inject(DI.noteDraftsRepository)
		private noteDraftsRepository: NoteDraftsRepository,

		private noteCreateService: NoteCreateService,
		private notificationService: NotificationService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('post-scheduled-note');
	}

	@bindThis
	public async process(job: Bull.Job<PostScheduledNoteJobData>): Promise<void> {
		if (job.data.noteDraftId != null) {
			await this.processNoteDraft(job.data.noteDraftId);
			return;
		}

		if (job.data.scheduledNoteId != null) {
			await this.processScheduledNote(job.data.scheduledNoteId);
			return;
		}

		this.logger.warn('Skipped scheduled note job without noteDraftId or scheduledNoteId.');
	}

	@bindThis
	private async processScheduledNote(scheduledNoteId: string): Promise<void> {
		const scheduledNote = await this.scheduledNotesRepository.findOne({
			where: { id: scheduledNoteId },
			relations: { user: true },
		});
		if (scheduledNote == null || scheduledNote.user == null || scheduledNote.scheduledAt == null) {
			return;
		}

		const draft = scheduledNote.draft;
		try {
			const note = await this.noteCreateService.fetchAndCreate(scheduledNote.user, {
				createdAt: new Date(),
				fileIds: draft.fileIds,
				poll: draft.poll ? {
					choices: draft.poll.choices,
					multiple: draft.poll.multiple,
					expiresAt: draft.poll.expiredAfter ? new Date(Date.now() + draft.poll.expiredAfter) : draft.poll.expiresAt ? new Date(draft.poll.expiresAt) : null,
				} : null,
				text: draft.text ?? null,
				replyId: draft.replyId,
				renoteId: draft.renoteId,
				cw: draft.cw,
				localOnly: draft.localOnly,
				reactionAcceptance: draft.reactionAcceptance,
				visibility: draft.visibility,
				visibleUserIds: draft.visibleUserIds,
				channelId: draft.channelId,
			});

			await this.scheduledNotesRepository.remove(scheduledNote);

			this.notificationService.createNotification(scheduledNote.userId, 'scheduledNotePosted', {
				noteId: note.id,
			});
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			await this.scheduledNotesRepository.update(scheduledNote.id, { reason });
			this.notificationService.createNotification(scheduledNote.userId, 'scheduledNotePostFailed', {
				noteDraftId: scheduledNote.id,
			});
		}
	}

	@bindThis
	private async processNoteDraft(noteDraftId: string): Promise<void> {
		const noteDraft = await this.noteDraftsRepository.findOne({
			where: { id: noteDraftId },
			relations: { user: true },
		});
		if (noteDraft == null || noteDraft.user == null || noteDraft.scheduledAt == null || !noteDraft.isActuallyScheduled) {
			return;
		}

		try {
			const note = await this.noteCreateService.fetchAndCreate(noteDraft.user, {
				createdAt: new Date(),
				fileIds: noteDraft.fileIds,
				poll: noteDraft.hasPoll ? {
					choices: noteDraft.pollChoices,
					multiple: noteDraft.pollMultiple,
					expiresAt: noteDraft.pollExpiredAfter ? new Date(Date.now() + noteDraft.pollExpiredAfter) : noteDraft.pollExpiresAt,
				} : null,
				text: noteDraft.text,
				replyId: noteDraft.replyId,
				renoteId: noteDraft.renoteId,
				cw: noteDraft.cw,
				localOnly: noteDraft.localOnly,
				reactionAcceptance: noteDraft.reactionAcceptance,
				visibility: noteDraft.visibility,
				visibleUserIds: noteDraft.visibleUserIds,
				channelId: noteDraft.channelId,
			});

			await this.noteDraftsRepository.delete(noteDraft.id);

			this.notificationService.createNotification(noteDraft.userId, 'scheduledNotePosted', {
				noteId: note.id,
			});
		} catch {
			await this.noteDraftsRepository.update(noteDraft.id, { isActuallyScheduled: false });
			this.notificationService.createNotification(noteDraft.userId, 'scheduledNotePostFailed', {
				noteDraftId: noteDraft.id,
			});
		}
	}
}
