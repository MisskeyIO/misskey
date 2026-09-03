/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, jest, test } from '@jest/globals';
import type * as Bull from 'bullmq';
import { NOTE_CREATE_PERMANENT_ERROR_IDS } from '@/core/NoteCreateService.js';
import { getPostScheduledNoteJobId, getPostScheduledNoteJobOptions, POST_SCHEDULED_NOTE_ATTEMPTS } from '@/core/QueueService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type { MiNoteDraft } from '@/models/NoteDraft.js';
import { LEGACY_SCHEDULED_NOTE_MIGRATED, LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL } from '@/models/ScheduledNote.js';
import { CheckMissingScheduledNoteProcessorService } from '@/queue/processors/CheckMissingScheduledNoteProcessorService.js';
import { appendHashtags, isPermanentScheduledNoteError, PostScheduledNoteProcessorService } from '@/queue/processors/PostScheduledNoteProcessorService.js';
import { ScheduledNoteProcessorService } from '@/queue/processors/ScheduledNoteProcessorService.js';
import type { PostScheduledNoteJobData } from '@/queue/types.js';
import ScheduledNoteCancelEndpoint from '@/server/api/endpoints/notes/scheduled/cancel.js';
import ScheduledNoteListEndpoint from '@/server/api/endpoints/notes/scheduled/list.js';

function queryBuilder(result: unknown): any {
	const builder: any = {};
	for (const method of ['update', 'delete', 'set', 'where', 'andWhere', 'setParameter', 'returning', 'leftJoinAndSelect', 'orderBy', 'addOrderBy', 'offset', 'limit']) {
		builder[method] = jest.fn(() => builder);
	}
	builder.execute = jest.fn(async () => result);
	builder.getOne = jest.fn(async () => result);
	builder.getMany = jest.fn(async () => result);
	return builder;
}

function draft(overrides: Partial<MiNoteDraft> = {}): MiNoteDraft {
	return {
		id: 'draft-id',
		userId: 'user-id',
		user: {
			id: 'user-id',
			username: 'user',
			host: null,
			isBot: false,
			isCat: false,
			isSuspended: false,
		},
		text: 'test',
		cw: null,
		replyId: null,
		reply: null,
		renoteId: null,
		renote: null,
		localOnly: false,
		dimension: 0,
		lang: null,
		reactionAcceptance: null,
		visibility: 'public',
		fileIds: [],
		visibleUserIds: [],
		hashtag: null,
		channelId: null,
		channel: null,
		hasPoll: false,
		pollChoices: [],
		pollMultiple: false,
		pollExpiresAt: null,
		pollExpiredAfter: null,
		scheduledAt: new Date(1_000),
		isActuallyScheduled: true,
		scheduledFailureReason: null,
		noExtractMentions: true,
		noExtractHashtags: true,
		noExtractEmojis: true,
		reservedNoteId: 'reserved-note-id',
		...overrides,
	} as MiNoteDraft;
}

function postProcessor(options: {
	builders: any[];
	draft: MiNoteDraft;
	fetchAndCreate: (user: unknown, data: unknown) => Promise<{ id: string }>;
	existingNote?: { id: string; userId: string } | null;
}) {
	const createQueryBuilder = jest.fn();
	for (const builder of options.builders) createQueryBuilder.mockReturnValueOnce(builder);
	const noteDraftsRepository = {
		createQueryBuilder,
		findOne: jest.fn(async () => options.draft),
	};
	const notesRepository = { findOneBy: jest.fn(async () => options.existingNote ?? null) };
	const noteCreateService = { fetchAndCreate: jest.fn(options.fetchAndCreate) };
	const notificationService = { createNotificationAsync: jest.fn(async (_userId: string, _type: string, _data: unknown) => undefined) };
	const logger = { warn: jest.fn() };
	const service = new PostScheduledNoteProcessorService(
		noteDraftsRepository as never,
		notesRepository as never,
		noteCreateService as never,
		notificationService as never,
		{ gen: jest.fn(() => 'candidate-id'), parse: jest.fn(() => ({ date: new Date(1_000) })) } as never,
		{ logger: { createSubLogger: () => logger } } as never,
	);

	return { service, noteDraftsRepository, notesRepository, noteCreateService, notificationService, logger };
}

describe('PostScheduledNoteProcessorService', () => {
	test('job IDは予約世代ごとに固定される', () => {
		expect(getPostScheduledNoteJobId('draft-id', 1_000)).toBe('scheduled-note-draft-id-1000');
		expect(getPostScheduledNoteJobId('draft-id', new Date(1_000))).toBe('scheduled-note-draft-id-1000');
		expect(getPostScheduledNoteJobId('draft-id', 2_000)).not.toBe(getPostScheduledNoteJobId('draft-id', 1_000));
		expect(POST_SCHEDULED_NOTE_ATTEMPTS).toBeGreaterThan(1);
		expect(getPostScheduledNoteJobOptions('draft-id', new Date(500), 1_000)).toEqual(expect.objectContaining({
			delay: 0,
			attempts: POST_SCHEDULED_NOTE_ATTEMPTS,
		}));
	});

	test('予約本文へhashtagを付与する', () => {
		expect(appendHashtags('本文', 'tag #tag2')).toBe('本文 #tag #tag2');
		expect(appendHashtags('本文\n', 'tag')).toBe('本文\n#tag');
		expect(appendHashtags(null, 'tag')).toBe('#tag');
	});

	test('NoteCreateServiceの既知エラーを恒久失敗として扱う', () => {
		for (const id of Object.values(NOTE_CREATE_PERMANENT_ERROR_IDS)) {
			expect(isPermanentScheduledNoteError(new IdentifiableError(id, 'test'))).toBe(true);
		}
		expect(isPermanentScheduledNoteError(new IdentifiableError('unknown', 'test'))).toBe(false);
		expect(NOTE_CREATE_PERMANENT_ERROR_IDS.noSuchReply).toBe('60142edb-1519-408e-926d-4f108d27bee0');
		expect(NOTE_CREATE_PERMANENT_ERROR_IDS.noSuchChannel).toBe('bfa3905b-25f5-4894-b430-da331a490e4b');
	});

	test('staleな予約世代は投稿しない', async () => {
		const claim = queryBuilder({ affected: 0 });
		const noteDraftsRepository = {
			createQueryBuilder: jest.fn(() => claim),
			findOne: jest.fn(),
		};
		const noteCreateService = { fetchAndCreate: jest.fn() };
		const service = new PostScheduledNoteProcessorService(
			noteDraftsRepository as never,
			{ findOneBy: jest.fn() } as never,
			noteCreateService as never,
			{ createNotificationAsync: jest.fn() } as never,
			{ gen: jest.fn(() => 'candidate-id'), parse: jest.fn() } as never,
			{ logger: { createSubLogger: () => ({ warn: jest.fn() }) } } as never,
		);

		await service.process({ data: { noteDraftId: 'draft-id', scheduledAt: 1_000 } } as Bull.Job<PostScheduledNoteJobData>);

		expect(noteDraftsRepository.findOne).not.toHaveBeenCalled();
		expect(noteCreateService.fetchAndCreate).not.toHaveBeenCalled();
	});

	test('抽出抑止を空配列として渡し、成功後にdraftを削除する', async () => {
		const claim = queryBuilder({ affected: 1 });
		const complete = queryBuilder({ affected: 1 });
		const noteDraft = draft();
		const noteDraftsRepository = {
			createQueryBuilder: jest.fn()
				.mockReturnValueOnce(claim)
				.mockReturnValueOnce(complete),
			findOne: jest.fn(async () => noteDraft),
		};
		const noteCreateService = { fetchAndCreate: jest.fn(async (_user: unknown, _data: unknown) => ({ id: noteDraft.reservedNoteId })) };
		const notificationService = { createNotificationAsync: jest.fn(async (_userId: string, _type: string, _data: unknown) => undefined) };
		const service = new PostScheduledNoteProcessorService(
			noteDraftsRepository as never,
			{ findOneBy: jest.fn() } as never,
			noteCreateService as never,
			notificationService as never,
			{ gen: jest.fn(() => 'candidate-id'), parse: jest.fn(() => ({ date: new Date(1_000) })) } as never,
			{ logger: { createSubLogger: () => ({ warn: jest.fn() }) } } as never,
		);

		await service.process({ data: { noteDraftId: noteDraft.id, scheduledAt: 1_000 } } as Bull.Job<PostScheduledNoteJobData>);

		expect(noteCreateService.fetchAndCreate).toHaveBeenCalledWith(noteDraft.user, expect.objectContaining({
			id: noteDraft.reservedNoteId,
			apMentions: [],
			apHashtags: [],
			apEmojis: [],
		}));
		expect(notificationService.createNotificationAsync).toHaveBeenCalledWith(noteDraft.userId, 'scheduledNotePosted', {
			noteId: noteDraft.reservedNoteId,
		});
	});

	test('既知の恒久エラーは失敗draftとして保持する', async () => {
		const claim = queryBuilder({ affected: 1 });
		const fail = queryBuilder({ affected: 1 });
		const noteDraft = draft();
		const dependencies = postProcessor({
			builders: [claim, fail],
			draft: noteDraft,
			fetchAndCreate: async () => {
				throw new IdentifiableError(NOTE_CREATE_PERMANENT_ERROR_IDS.noSuchReply, 'No such reply');
			},
		});

		await dependencies.service.process({ data: { noteDraftId: noteDraft.id, scheduledAt: 1_000 } } as Bull.Job<PostScheduledNoteJobData>);

		expect(fail.set).toHaveBeenCalledWith({
			isActuallyScheduled: false,
			scheduledFailureReason: NOTE_CREATE_PERMANENT_ERROR_IDS.noSuchReply,
			reservedNoteId: null,
		});
		expect(dependencies.notificationService.createNotificationAsync).toHaveBeenCalledWith(noteDraft.userId, 'scheduledNotePostFailed', {
			noteDraftId: noteDraft.id,
		});
	});

	test('未知の失敗はdraftを維持して再試行する', async () => {
		const claim = queryBuilder({ affected: 1 });
		const noteDraft = draft();
		const dependencies = postProcessor({
			builders: [claim],
			draft: noteDraft,
			fetchAndCreate: async () => {
				throw new Error('temporary');
			},
		});

		await expect(dependencies.service.process({
			data: { noteDraftId: noteDraft.id, scheduledAt: 1_000 },
		} as Bull.Job<PostScheduledNoteJobData>)).rejects.toThrow('予約投稿の実行に一時的に失敗しました');

		expect(dependencies.noteDraftsRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
		expect(dependencies.notificationService.createNotificationAsync).not.toHaveBeenCalled();
		expect(dependencies.logger.warn).toHaveBeenCalledWith('予約投稿の実行を再試行します', expect.objectContaining({
			draftId: noteDraft.id,
			errorName: 'Error',
		}));
	});

	test('固定IDのnoteが既にあればdraft削除を完了する', async () => {
		const claim = queryBuilder({ affected: 1 });
		const complete = queryBuilder({ affected: 1 });
		const noteDraft = draft();
		const dependencies = postProcessor({
			builders: [claim, complete],
			draft: noteDraft,
			fetchAndCreate: async () => {
				throw new Error('crashed after insert');
			},
			existingNote: { id: noteDraft.reservedNoteId!, userId: noteDraft.userId },
		});

		await dependencies.service.process({ data: { noteDraftId: noteDraft.id, scheduledAt: 1_000 } } as Bull.Job<PostScheduledNoteJobData>);

		expect(complete.delete).toHaveBeenCalled();
		expect(dependencies.notificationService.createNotificationAsync).toHaveBeenCalledWith(noteDraft.userId, 'scheduledNotePosted', {
			noteId: noteDraft.reservedNoteId,
		});
	});
});

describe('CheckMissingScheduledNoteProcessorService', () => {
	test('失敗したjobを除去して同じ予約世代を再投入する', async () => {
		const scheduledAt = new Date(1_000);
		const drafts = queryBuilder([]);
		drafts.getMany
			.mockResolvedValueOnce([draft({ scheduledAt })])
			.mockResolvedValueOnce([]);
		const postScheduledNoteQueue = {
			getJobState: jest.fn(async () => 'failed'),
			remove: jest.fn(async (_jobId: string) => 1),
		};
		const queueService = {
			postScheduledNoteQueue,
			createPostScheduledNoteJob: jest.fn(async (_draftId: string, _scheduledAt: Date) => undefined),
		};
		const service = new CheckMissingScheduledNoteProcessorService(
			{} as never,
			{} as never,
			{ createQueryBuilder: jest.fn(() => drafts) } as never,
			queueService as never,
			{ logger: { createSubLogger: () => ({ info: jest.fn(), warn: jest.fn() }) } } as never,
		);

		await service['recoverNoteDraftSchedules']();

		const jobId = getPostScheduledNoteJobId('draft-id', scheduledAt);
		expect(postScheduledNoteQueue.remove).toHaveBeenCalledWith(jobId);
		expect(queueService.createPostScheduledNoteJob).toHaveBeenCalledWith('draft-id', scheduledAt);
		expect(drafts.orderBy).toHaveBeenCalledWith('draft.scheduledAt', 'ASC');
		expect(drafts.addOrderBy).toHaveBeenCalledWith('draft.id', 'ASC');
	});

	test('旧予約の回復は移行台帳を除外する', async () => {
		const drafts = queryBuilder([]);
		const service = new CheckMissingScheduledNoteProcessorService(
			{} as never,
			{ createQueryBuilder: jest.fn(() => drafts) } as never,
			{} as never,
			{} as never,
			{ logger: { createSubLogger: () => ({ info: jest.fn(), warn: jest.fn() }) } } as never,
		);

		await service['recoverLegacySchedules']();

		expect(drafts.andWhere).toHaveBeenCalledWith(LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL);
	});
});

describe('旧予約との分離', () => {
	test('旧workerは移行台帳のある行を投稿しない', async () => {
		const drafts = queryBuilder(null);
		const noteCreateService = { create: jest.fn() };
		const service = new ScheduledNoteProcessorService(
			{} as never,
			{ createQueryBuilder: jest.fn(() => drafts) } as never,
			{} as never,
			noteCreateService as never,
			{ logger: { createSubLogger: () => ({ info: jest.fn(), warn: jest.fn() }) } } as never,
		);

		await service['processLocked']({ data: { draftId: 'legacy-id' } } as Bull.Job);

		expect(drafts.andWhere).toHaveBeenCalledWith(LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL);
		expect(noteCreateService.create).not.toHaveBeenCalled();
	});

	test('旧一覧はmarkerと移行台帳を除外する', async () => {
		const drafts = queryBuilder([]);
		const repository = { createQueryBuilder: jest.fn(() => drafts) };
		const packService = { packMany: jest.fn(async () => []) };
		const endpoint = new ScheduledNoteListEndpoint(repository as never, packService as never);

		await endpoint.exec({ limit: 10, offset: 0 }, { id: 'user-id' } as never, null);

		expect(drafts.andWhere).toHaveBeenCalledWith(
			'(draft.reason IS NULL OR draft.reason <> :migrated)',
			{ migrated: LEGACY_SCHEDULED_NOTE_MIGRATED },
		);
		expect(drafts.andWhere).toHaveBeenCalledWith(LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL);
	});

	test('旧取消は選択と削除の両方で移行台帳を除外する', async () => {
		const draft = { id: 'legacyid' };
		const select = queryBuilder(draft);
		const remove = queryBuilder({ affected: 1 });
		const repository = {
			createQueryBuilder: jest.fn()
				.mockReturnValueOnce(select)
				.mockReturnValueOnce(remove),
		};
		const queueService = { systemQueue: { remove: jest.fn(async (_jobId: string) => 1) } };
		const endpoint = new ScheduledNoteCancelEndpoint(repository as never, queueService as never);

		await endpoint.exec({ draftId: draft.id }, { id: 'user-id' } as never, null);

		expect(select.andWhere).toHaveBeenCalledWith(LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL);
		expect(remove.andWhere).toHaveBeenCalledWith(expect.stringContaining('note_scheduled_migration'));
		expect(queueService.systemQueue.remove).toHaveBeenCalledWith(`scheduledNote-${draft.id}`);
	});
});
