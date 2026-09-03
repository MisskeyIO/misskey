/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, jest, test } from '@jest/globals';
import NotesCreateEndpoint from '@/server/api/endpoints/notes/create.js';

function dependencies(idempotent: string | null = null, reservationResult: 'OK' | null = 'OK') {
	const draft = { id: 'draftid', userId: 'userid' };
	const redis = {
		get: jest.fn(async (_key: string) => idempotent),
		set: jest.fn(async (_key: string, _value: string, _mode: string, _ttl: number, _condition?: string) => reservationResult),
		unlinkIf: jest.fn(async (_key: string, _value: string) => 1),
	};
	const notesRepository = { findOneBy: jest.fn(async (_where: unknown) => null) };
	const noteCreateService = { fetchAndCreate: jest.fn() };
	const noteDraftService = {
		get: jest.fn(async (_me: unknown, _id: string) => idempotent === draft.id ? draft : null),
		create: jest.fn(async (_me: unknown, _data: unknown, _draftId?: string) => draft),
	};
	const endpoint = new NotesCreateEndpoint(
		redis as never,
		notesRepository as never,
		{ gen: () => draft.id } as never,
		{ getLogger: () => ({ error: jest.fn() }) } as never,
		{ pack: jest.fn() } as never,
		noteCreateService as never,
		noteDraftService as never,
	);

	return { endpoint, redis, notesRepository, noteCreateService, noteDraftService, draft };
}

describe('notes/createの予約互換', () => {
	test('将来時刻は即時投稿せずserver draftへ保存する', async () => {
		const target = dependencies();
		const scheduledAt = Date.now() + 60_000;

		await expect(target.endpoint.exec({
			text: 'test',
			scheduledAt,
			poll: {
				choices: ['a', 'b'],
				multiple: true,
				expiredAfter: 3_600_000,
			},
			dimension: 1000,
			lang: 'ja',
			noExtractMentions: true,
			noExtractHashtags: true,
			noExtractEmojis: true,
		}, { id: 'userid' } as never, null)).resolves.toBeUndefined();

		expect(target.noteCreateService.fetchAndCreate).not.toHaveBeenCalled();
		expect(target.noteDraftService.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'userid' }), expect.objectContaining({
			text: 'test',
			scheduledAt: new Date(scheduledAt),
			isActuallyScheduled: true,
			pollChoices: ['a', 'b'],
			pollMultiple: true,
			pollExpiredAfter: 3_600_000,
			dimension: 1000,
			lang: 'ja',
			noExtractMentions: true,
			noExtractHashtags: true,
			noExtractEmojis: true,
		}), target.draft.id);
		expect(target.redis.set).toHaveBeenCalledWith(expect.any(String), target.draft.id, 'EX', 30, 'NX');
		expect(target.redis.set.mock.invocationCallOrder[0]).toBeLessThan(target.noteDraftService.create.mock.invocationCallOrder[0]);
	});

	test('Redisにdraft IDがあれば同じ予約を再作成しない', async () => {
		const target = dependencies('draftid');

		await target.endpoint.exec({ text: 'test', scheduledAt: Date.now() + 60_000 }, { id: 'userid' } as never, null);

		expect(target.noteDraftService.get).toHaveBeenCalledWith(expect.objectContaining({ id: 'userid' }), target.draft.id);
		expect(target.noteDraftService.create).not.toHaveBeenCalled();
		expect(target.noteCreateService.fetchAndCreate).not.toHaveBeenCalled();
	});

	test('同時要求が予約済みなら別の下書きを作らない', async () => {
		const target = dependencies(null, null);

		await expect(target.endpoint.exec({ text: 'test', scheduledAt: Date.now() + 60_000 }, { id: 'userid' } as never, null)).rejects.toMatchObject({
			code: 'PROCESSING',
		});

		expect(target.noteDraftService.create).not.toHaveBeenCalled();
	});
});
