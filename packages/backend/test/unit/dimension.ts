/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'assert';
import { describe, test } from 'vitest';

import { getDeliverTargetDimensions } from '@/misc/dimension.js';
import type { MiNoteWithDimension } from '@/models/Note.js';

describe('getDeliverTargetDimensions', () => {
	const mockCacheGetter = async (noteId: string): Promise<number | null | undefined> => {
		const mockDimensions: Record<string, number> = {
			'reply-dim-2': 2,
			'reply-dim-1': 1,
			'reply-dim-1000': 1000,
			'reply-dim-1001': 1001,
			'renote-dim-2': 2,
			'renote-dim-1': 1,
		};
		return mockDimensions[noteId] ?? null;
	};

	test('note with dimension 0 should deliver to dimension 0 only', async () => {
		const note: MiNoteWithDimension = { dimension: 0 };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [0]);
	});

	test('note with no dimension should deliver to dimension 0 only', async () => {
		const note: MiNoteWithDimension = {};
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [0]);
	});

	test('note with dimension 1 should deliver to dimension 0 and 1', async () => {
		const note: MiNoteWithDimension = { dimension: 1 };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [0, 1]);
	});

	test('note with dimension 999 should deliver to dimension 0 and 999', async () => {
		const note: MiNoteWithDimension = { dimension: 999 };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [0, 999]);
	});

	test('note with dimension 1000 should deliver to dimension 1000 only', async () => {
		const note: MiNoteWithDimension = { dimension: 1000 };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [1000]);
	});

	test('note with dimension 1001 should deliver to dimension 1001 only', async () => {
		const note: MiNoteWithDimension = { dimension: 1001 };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [1001]);
	});

	test('note in dimension 1 replying to dimension 2 should deliver to dimension 0, 1, and 2', async () => {
		const note: MiNoteWithDimension = { dimension: 1, replyId: 'reply-dim-2' };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [0, 1, 2]);
	});

	test('note in dimension 1000 replying to dimension 1 should deliver to dimension 1 and 1000 only', async () => {
		const note: MiNoteWithDimension = { dimension: 1000, replyId: 'reply-dim-1' };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [1, 1000]);
	});

	test('note in dimension 1 replying to dimension 1000 should deliver to dimension 0, 1, and 1000', async () => {
		const note: MiNoteWithDimension = { dimension: 1, replyId: 'reply-dim-1000' };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [0, 1, 1000]);
	});

	test('note in dimension 1000 replying to dimension 1001 should deliver to dimension 1000 and 1001 only', async () => {
		const note: MiNoteWithDimension = { dimension: 1000, replyId: 'reply-dim-1001' };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [1000, 1001]);
	});

	test('note in dimension 1 renoting dimension 2 should deliver to dimension 0, 1, and 2', async () => {
		const note: MiNoteWithDimension = { dimension: 1, renoteId: 'renote-dim-2' };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [0, 1, 2]);
	});

	test('note in dimension 1000 renoting dimension 1 should deliver to dimension 1 and 1000 only', async () => {
		const note: MiNoteWithDimension = { dimension: 1000, renoteId: 'renote-dim-1' };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [1, 1000]);
	});

	test('note in dimension 1 replying to same dimension should deliver to dimension 0 and 1 only', async () => {
		const note: MiNoteWithDimension = { dimension: 1, replyId: 'reply-dim-1' };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [0, 1]);
	});

	test('note in dimension 0 replying to dimension 1 should deliver to dimension 0 and 1', async () => {
		const note: MiNoteWithDimension = { dimension: 0, replyId: 'reply-dim-1' };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [0, 1]);
	});

	test('note in dimension 0 replying to dimension 1000 should deliver to dimension 0 and 1000', async () => {
		const note: MiNoteWithDimension = { dimension: 0, replyId: 'reply-dim-1000' };
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		assert.deepStrictEqual(result, [0, 1000]);
	});
});
