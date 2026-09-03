/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MiNoteDraft, NoteDraftsRepository, NotesRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { NotificationService } from '@/core/NotificationService.js';
import { bindThis } from '@/decorators.js';
import { NOTE_CREATE_PERMANENT_ERROR_IDS, NoteCreateService } from '@/core/NoteCreateService.js';
import { IdService } from '@/core/IdService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { PostScheduledNoteJobData } from '../types.js';

const permanentErrorIds = new Set<string>(Object.values(NOTE_CREATE_PERMANENT_ERROR_IDS));

export function isPermanentScheduledNoteError(err: unknown): err is IdentifiableError {
	return err instanceof IdentifiableError && permanentErrorIds.has(err.id);
}

export function appendHashtags(text: string | null, hashtag: string | null): string | null {
	if (hashtag == null || hashtag.trim() === '') return text;
	const hashtags = hashtag.trim().split(/\s+/).map(value => value.startsWith('#') ? value : `#${value}`).join(' ');
	if (text == null || text === '') return hashtags;

	const lines = text.split('\n');
	const last = lines.length - 1;
	lines[last] += lines[last].trim() === '' ? hashtags : ` ${hashtags}`;
	return lines.join('\n');
}

@Injectable()
export class PostScheduledNoteProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.noteDraftsRepository)
		private noteDraftsRepository: NoteDraftsRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private noteCreateService: NoteCreateService,
		private notificationService: NotificationService,
		private idService: IdService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('post-scheduled-note');
	}

	@bindThis
	public async process(job: Bull.Job<PostScheduledNoteJobData>): Promise<void> {
		const scheduledAt = job.data.scheduledAt;
		if (!Number.isSafeInteger(scheduledAt)) return;

		const candidateNoteId = this.idService.gen();
		const claim = await this.noteDraftsRepository.createQueryBuilder().update()
			.set({
				reservedNoteId: () => 'COALESCE("reservedNoteId", :candidateNoteId)',
			})
			.where('id = :id', { id: job.data.noteDraftId })
			.andWhere('"scheduledAt" = :scheduledAt', { scheduledAt: new Date(scheduledAt) })
			.andWhere('"scheduledAt" <= now()')
			.andWhere('"isActuallyScheduled" = true')
			.andWhere('"scheduledFailureReason" IS NULL')
			.setParameter('candidateNoteId', candidateNoteId)
			.execute();
		if (claim.affected !== 1) return;

		const draft = await this.noteDraftsRepository.findOne({
			where: { id: job.data.noteDraftId },
			relations: ['user'],
		});
		if (draft == null || draft.reservedNoteId == null) return;

		if (draft.user == null || draft.user.isSuspended) {
			await this.fail(draft, 'user-unavailable');
			return;
		}
		try {
			const note = await this.noteCreateService.fetchAndCreate(draft.user, {
				id: draft.reservedNoteId,
				createdAt: this.idService.parse(draft.reservedNoteId).date,
				fileIds: draft.fileIds,
				poll: draft.hasPoll ? {
					choices: draft.pollChoices,
					multiple: draft.pollMultiple,
					expiresAt: draft.pollExpiredAfter ? new Date(Date.now() + draft.pollExpiredAfter) : draft.pollExpiresAt ? new Date(draft.pollExpiresAt) : null,
				} : null,
				text: appendHashtags(draft.text ?? null, draft.hashtag),
				replyId: draft.replyId,
				renoteId: draft.renoteId,
				cw: draft.cw,
				localOnly: draft.localOnly,
				dimension: draft.dimension ?? 0,
				lang: draft.lang,
				reactionAcceptance: draft.reactionAcceptance,
				visibility: draft.visibility,
				visibleUserIds: draft.visibleUserIds,
				channelId: draft.channelId,
				apMentions: draft.noExtractMentions ? [] : undefined,
				apHashtags: draft.noExtractHashtags ? [] : undefined,
				apEmojis: draft.noExtractEmojis ? [] : undefined,
			});

			await this.complete(draft, note.id);
		} catch (err) {
			const note = await this.notesRepository.findOneBy({ id: draft.reservedNoteId });
			if (note?.userId === draft.userId) {
				await this.complete(draft, note.id);
				return;
			}

			if (isPermanentScheduledNoteError(err)) {
				await this.fail(draft, err.id);
				return;
			}

			this.logger.warn('予約投稿の実行を再試行します', {
				draftId: draft.id,
				scheduledAt,
				errorName: err instanceof Error ? err.name : 'unknown',
			});
			throw new Error('予約投稿の実行に一時的に失敗しました');
		}
	}

	private async complete(draft: MiNoteDraft, noteId: string): Promise<void> {
		const result = await this.noteDraftsRepository.createQueryBuilder().delete()
			.where('id = :id', { id: draft.id })
			.andWhere('"reservedNoteId" = :reservedNoteId', { reservedNoteId: draft.reservedNoteId })
			.execute();
		if (result.affected !== 1) return;

		await this.notificationService.createNotificationAsync(draft.userId, 'scheduledNotePosted', {
			noteId,
		});
	}

	private async fail(draft: MiNoteDraft, reason: string): Promise<void> {
		const result = await this.noteDraftsRepository.createQueryBuilder().update()
			.set({
				isActuallyScheduled: false,
				scheduledFailureReason: reason,
				reservedNoteId: null,
			})
			.where('id = :id', { id: draft.id })
			.andWhere('"scheduledAt" = :scheduledAt', { scheduledAt: draft.scheduledAt })
			.andWhere('"reservedNoteId" = :reservedNoteId', { reservedNoteId: draft.reservedNoteId })
			.execute();
		if (result.affected !== 1) return;

		await this.notificationService.createNotificationAsync(draft.userId, 'scheduledNotePostFailed', {
			noteDraftId: draft.id,
		});
	}
}
