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
		const note = { dimension: 0 } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([0]);
	});

	test('note with no dimension (undefined) should deliver to dimension 0 only', async () => {
		const note = {} as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([0]);
	});

	test('note with dimension 1 should deliver to dimension 0 and 1', async () => {
		const note = { dimension: 1 } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([0, 1]);
	});

	test('note with dimension 999 should deliver to dimension 0 and 999', async () => {
		const note = { dimension: 999 } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([0, 999]);
	});

	test('note with dimension 1000 (private) should deliver to dimension 1000 only', async () => {
		const note = { dimension: 1000 } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([1000]);
	});

	test('note with dimension 1001 (private) should deliver to dimension 1001 only', async () => {
		const note = { dimension: 1001 } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([1001]);
	});

	test('note in dimension 1 replying to dimension 2 should deliver to dimension 0, 1, and 2', async () => {
		const note = { dimension: 1, replyId: 'reply-dim-2' } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([0, 1, 2]);
	});

	test('note in dimension 1000 (private) replying to dimension 1 should deliver to dimension 1 and 1000 only', async () => {
		const note = { dimension: 1000, replyId: 'reply-dim-1' } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([1, 1000]);
	});

	test('note in dimension 1 replying to dimension 1000 (private) should deliver to dimension 0, 1, and 1000', async () => {
		const note = { dimension: 1, replyId: 'reply-dim-1000' } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([0, 1, 1000]);
	});

	test('note in dimension 1000 (private) replying to dimension 1001 (private) should deliver to dimension 1000 and 1001 only', async () => {
		const note = { dimension: 1000, replyId: 'reply-dim-1001' } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([1000, 1001]);
	});

	test('note in dimension 1 renoting dimension 2 should deliver to dimension 0, 1, and 2', async () => {
		const note = { dimension: 1, renoteId: 'renote-dim-2' } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([0, 1, 2]);
	});

	test('note in dimension 1000 (private) renoting dimension 1 should deliver to dimension 1 and 1000 only', async () => {
		const note = { dimension: 1000, renoteId: 'renote-dim-1' } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([1, 1000]);
	});

	test('note in dimension 1 replying to same dimension should deliver to dimension 0 and 1 only', async () => {
		const note = { dimension: 1, replyId: 'reply-dim-1' } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([0, 1]);
	});

	test('note in dimension 0 replying to dimension 1 should deliver to dimension 0 and 1', async () => {
		const note = { dimension: 0, replyId: 'reply-dim-1' } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([0, 1]);
	});

	test('note in dimension 0 replying to dimension 1000 (private) should deliver to dimension 0 and 1000', async () => {
		const note = { dimension: 0, replyId: 'reply-dim-1000' } as MiNoteWithDimension;
		const result = await getDeliverTargetDimensions(note, mockCacheGetter);
		expect(result).toEqual([0, 1000]);
	});
});
