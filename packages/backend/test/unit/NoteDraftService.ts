/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { BlockingsRepository, ChannelsRepository, DriveFilesRepository, NoteDraftsRepository, NotesRepository, ScheduledNotesRepository, UsersRepository } from '@/models/_.js';
import type { MiLocalUser } from '@/models/User.js';
import { NoteDraftService } from '@/core/NoteDraftService.js';
import { DEFAULT_POLICIES, RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { QueueService } from '@/core/QueueService.js';
import { PostScheduledNoteProcessorService } from '@/queue/processors/PostScheduledNoteProcessorService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import { MiNoteDraft } from '@/models/NoteDraft.js';
import { MiNote } from '@/models/Note.js';
import type Logger from '@/logger.js';
import type { PostScheduledNoteJobData } from '@/queue/types.js';
import type * as Bull from 'bullmq';

describe('NoteDraftService', () => {
	function createService(roleService: RoleService): NoteDraftService {
		return new NoteDraftService(
			mockDeep<BlockingsRepository>(),
			mockDeep<NoteDraftsRepository>(),
			mockDeep<NotesRepository>(),
			mockDeep<UsersRepository>(),
			mockDeep<DriveFilesRepository>(),
			mockDeep<ChannelsRepository>(),
			roleService,
			mockDeep<IdService>(),
			mockDeep<NoteEntityService>(),
			mockDeep<QueueService>(),
		);
	}

	function createLocalUser(): MiLocalUser {
		const me = mockDeep<MiLocalUser>();
		me.id = 'user-id';
		return me;
	}

	describe('validate', () => {
		test('rejects scheduled drafts when policy disables scheduling', async () => {
			const roleService = mockDeep<RoleService>();
			roleService.getUserPolicies.mockResolvedValue({
				...DEFAULT_POLICIES,
				canScheduleNote: false,
				scheduledNoteLimit: 10,
				scheduleNoteMaxDays: 365,
			});

			await expect(createService(roleService).validate(createLocalUser(), {
				isActuallyScheduled: true,
				scheduledAt: new Date(Date.now() + 1000 * 60 * 60),
			})).rejects.toThrow('Scheduled notes are not allowed');
		});

		test('rejects scheduled drafts past scheduleNoteMaxDays', async () => {
			const roleService = mockDeep<RoleService>();
			roleService.getUserPolicies.mockResolvedValue({
				...DEFAULT_POLICIES,
				canScheduleNote: true,
				scheduledNoteLimit: 10,
				scheduleNoteMaxDays: 1,
			});

			await expect(createService(roleService).validate(createLocalUser(), {
				isActuallyScheduled: true,
				scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
			})).rejects.toThrow('scheduledAt exceeds maximum schedule window');
		});
	});

	describe('scheduled draft queue processor', () => {
		function createScheduledDraft(): MiNoteDraft {
			const draft = new MiNoteDraft();
			draft.id = 'draft-id';
			draft.userId = 'user-id';
			draft.user = createLocalUser();
			draft.replyId = null;
			draft.reply = null;
			draft.renoteId = null;
			draft.renote = null;
			draft.text = 'scheduled draft';
			draft.cw = null;
			draft.localOnly = false;
			draft.reactionAcceptance = null;
			draft.visibility = 'public';
			draft.fileIds = [];
			draft.visibleUserIds = [];
			draft.hashtag = null;
			draft.channelId = null;
			draft.channel = null;
			draft.hasPoll = false;
			draft.pollChoices = [];
			draft.pollMultiple = false;
			draft.pollExpiresAt = null;
			draft.pollExpiredAfter = null;
			draft.scheduledAt = new Date(Date.now() + 1000 * 60 * 60);
			draft.isActuallyScheduled = true;
			return draft;
		}

		function createProcessor(noteDraftsRepository: NoteDraftsRepository) {
			const queueLoggerService = mockDeep<QueueLoggerService>();
			queueLoggerService.logger.createSubLogger.mockReturnValue(mockDeep<Logger>());

			const noteCreateService = mockDeep<NoteCreateService>();
			const notificationService = mockDeep<NotificationService>();

			const processor = new PostScheduledNoteProcessorService(
				mockDeep<ScheduledNotesRepository>(),
				noteDraftsRepository,
				noteCreateService,
				notificationService,
				queueLoggerService,
			);

			return { processor, noteCreateService, notificationService };
		}

		test('publishes noteDraftId jobs and removes the draft', async () => {
			const noteDraftsRepository = mockDeep<NoteDraftsRepository>();
			const draft = createScheduledDraft();
			noteDraftsRepository.findOne.mockResolvedValue(draft);

			const { processor, noteCreateService, notificationService } = createProcessor(noteDraftsRepository);
			const note = { id: 'note-id' } as MiNote;
			noteCreateService.fetchAndCreate.mockResolvedValue(note);

			const job = mockDeep<Bull.Job<PostScheduledNoteJobData>>();
			job.data = { noteDraftId: draft.id };

			await processor.process(job);

			expect(noteCreateService.fetchAndCreate).toHaveBeenCalledWith(draft.user, expect.objectContaining({
				text: draft.text,
				visibility: draft.visibility,
				fileIds: draft.fileIds,
				poll: null,
			}));
			expect(noteDraftsRepository.delete).toHaveBeenCalledWith(draft.id);
			expect(notificationService.createNotification).toHaveBeenCalledWith(draft.userId, 'scheduledNotePosted', {
				noteId: note.id,
			});
		});

		test('keeps failed noteDraftId jobs as unscheduled drafts', async () => {
			const noteDraftsRepository = mockDeep<NoteDraftsRepository>();
			const draft = createScheduledDraft();
			noteDraftsRepository.findOne.mockResolvedValue(draft);

			const { processor, noteCreateService, notificationService } = createProcessor(noteDraftsRepository);
			noteCreateService.fetchAndCreate.mockRejectedValue(new Error('failed'));

			const job = mockDeep<Bull.Job<PostScheduledNoteJobData>>();
			job.data = { noteDraftId: draft.id };

			await processor.process(job);

			expect(noteDraftsRepository.update).toHaveBeenCalledWith(draft.id, { isActuallyScheduled: false });
			expect(notificationService.createNotification).toHaveBeenCalledWith(draft.userId, 'scheduledNotePostFailed', {
				noteDraftId: draft.id,
			});
		});
	});
});
