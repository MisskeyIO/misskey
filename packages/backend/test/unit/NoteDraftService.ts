/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, vi, test } from 'vitest';
import { INVALID_SCHEDULED_NOTE_ID, NoteDraftService } from '@/core/NoteDraftService.js';
import type { MiNoteDraft } from '@/models/NoteDraft.js';

function updateQueryBuilder(updated: MiNoteDraft): any {
	const builder: any = {};
	for (const method of ['update', 'set', 'where', 'andWhere', 'returning']) {
		builder[method] = vi.fn(() => builder);
	}
	builder.execute = vi.fn(async () => ({ raw: [updated], affected: 1 }));
	return builder;
}

function serviceFor(current: MiNoteDraft, updated: MiNoteDraft, queueResult = 1) {
	const builder = updateQueryBuilder(updated);
	const notesRepository = { findOneBy: vi.fn(() => { throw new Error('参照を再検証してはいけません'); }) };
	const driveFilesRepository = { createQueryBuilder: vi.fn(() => { throw new Error('参照を再検証してはいけません'); }) };
	const channelsRepository = { findOneBy: vi.fn(() => { throw new Error('参照を再検証してはいけません'); }) };
	const queueService = { removePostScheduledNoteJob: vi.fn(async (_draftId: string, _scheduledAt: Date) => queueResult) };
	const service = new NoteDraftService(
		{} as never,
		{
			findOneBy: vi.fn(async () => current),
			createQueryBuilder: vi.fn(() => builder),
		} as never,
		notesRepository as never,
		{} as never,
		driveFilesRepository as never,
		channelsRepository as never,
		{ getUserPolicies: vi.fn(async () => ({ canScheduleNote: true, scheduleNoteLimit: 10, scheduleNoteMaxDays: 3650 })) } as never,
		{} as never,
		{} as never,
		queueService as never,
		{ getLogger: () => ({ error: vi.fn() }) } as never,
	);
	return { service, builder, notesRepository, driveFilesRepository, channelsRepository, queueService };
}

describe('NoteDraftService', () => {
	test('欠損参照を持つ移行済み予約でも解除できる', async () => {
		const scheduledAt = new Date(Date.now() + 60_000);
		const current = {
			id: 'draft-id',
			userId: 'user-id',
			isActuallyScheduled: true,
			scheduledAt,
			reservedNoteId: null,
			scheduledFailureReason: null,
			replyId: 'deleted-reply-id',
			fileIds: ['deleted-file-id'],
			channelId: 'deleted-channel-id',
			dimension: 0,
		} as MiNoteDraft;
		const updated = { ...current, isActuallyScheduled: false, scheduledAt: null } as MiNoteDraft;
		const dependencies = serviceFor(current, updated);

		await expect(dependencies.service.update({ id: 'user-id' } as never, current.id, {
			isActuallyScheduled: false,
			scheduledAt: null,
		})).resolves.toEqual(updated);
		expect(dependencies.notesRepository.findOneBy).not.toHaveBeenCalled();
		expect(dependencies.driveFilesRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(dependencies.channelsRepository.findOneBy).not.toHaveBeenCalled();
		expect(dependencies.queueService.removePostScheduledNoteJob).toHaveBeenCalledWith(current.id, scheduledAt);
	});

	test('実行IDを確保済みの予約は更新も削除もしない', async () => {
		const scheduledAt = new Date(Date.now() + 60_000);
		const current = {
			id: 'draft-id',
			userId: 'user-id',
			isActuallyScheduled: true,
			scheduledAt,
			reservedNoteId: 'reserved-id',
			scheduledFailureReason: null,
			dimension: 0,
		} as MiNoteDraft;
		const updated = { ...current, isActuallyScheduled: false, scheduledAt: null } as MiNoteDraft;
		const dependencies = serviceFor(current, updated);

		await expect(dependencies.service.update({ id: 'user-id' } as never, current.id, {
			isActuallyScheduled: false,
			scheduledAt: null,
		})).rejects.toMatchObject({ id: '49cd6b9d-848e-41ee-b0b9-adaca711a6b1' });
		await expect(dependencies.service.delete({ id: 'user-id' } as never, current.id))
			.rejects.toMatchObject({ id: '49cd6b9d-848e-41ee-b0b9-adaca711a6b1' });

		expect(dependencies.builder.set).not.toHaveBeenCalled();
		expect(dependencies.queueService.removePostScheduledNoteJob).not.toHaveBeenCalled();
	});

	test('private次元ではlocalOnlyを解除できない', async () => {
		const current = {
			id: 'draft-id',
			userId: 'user-id',
			isActuallyScheduled: false,
			scheduledAt: null,
			reservedNoteId: null,
			scheduledFailureReason: null,
			dimension: 1000,
			localOnly: true,
		} as MiNoteDraft;
		const updated = { ...current } as MiNoteDraft;
		const dependencies = serviceFor(current, updated);

		await dependencies.service.update({ id: 'user-id' } as never, current.id, { localOnly: false });

		expect(dependencies.builder.set).toHaveBeenCalledWith(expect.objectContaining({ localOnly: true }));
	});

	test('添付のある予約は本文だけ空に更新できる', async () => {
		const scheduledAt = new Date(Date.now() + 60_000);
		const current = {
			id: 'draft-id',
			userId: 'user-id',
			isActuallyScheduled: true,
			scheduledAt,
			reservedNoteId: null,
			scheduledFailureReason: null,
			text: 'test',
			fileIds: ['file-id'],
			hasPoll: false,
			renoteId: null,
			dimension: 0,
		} as MiNoteDraft;
		const updated = { ...current, text: null } as MiNoteDraft;
		const dependencies = serviceFor(current, updated);

		await expect(dependencies.service.update({ id: 'user-id' } as never, current.id, { text: null })).resolves.toEqual(updated);

		expect(dependencies.driveFilesRepository.createQueryBuilder).not.toHaveBeenCalled();
	});

	test('通常draftは空でも保存できるが空の予約は拒否する', async () => {
		const current = { id: 'draft-id', userId: 'user-id', dimension: 0 } as MiNoteDraft;
		const dependencies = serviceFor(current, current);
		const empty = {
			text: null,
			hashtag: null,
			fileIds: [],
			hasPoll: false,
			renoteId: null,
		};

		await expect(dependencies.service.validate({ id: 'user-id' } as never, empty)).resolves.toBeUndefined();
		await expect(dependencies.service.validate({ id: 'user-id' } as never, {
			...empty,
			isActuallyScheduled: true,
			scheduledAt: new Date(Date.now() + 60_000),
		})).rejects.toMatchObject({ id: INVALID_SCHEDULED_NOTE_ID });
	});

	test('予約時は不正なpollを拒否する', async () => {
		const current = { id: 'draft-id', userId: 'user-id', dimension: 0 } as MiNoteDraft;
		const dependencies = serviceFor(current, current);

		await expect(dependencies.service.validate({ id: 'user-id' } as never, {
			text: 'test',
			fileIds: [],
			hasPoll: true,
			pollChoices: ['same', ' same '],
			isActuallyScheduled: true,
			scheduledAt: new Date(Date.now() + 60_000),
		})).rejects.toMatchObject({ id: INVALID_SCHEDULED_NOTE_ID });
	});
});
