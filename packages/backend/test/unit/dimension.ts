/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { getDeliverTargetDimensions } from '@/misc/dimension.js';
import type { MiNoteWithDimension } from '@/models/Note.js';

describe('getDeliverTargetDimensions', () => {
	test('note with dimension 0 should deliver to dimension 0 only', () => {
		const note = { dimension: 0 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note);
		expect(result).toEqual([0]);
	});

	test('note with no dimension (undefined) should deliver to dimension 0 only', () => {
		const note = {} as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note);
		expect(result).toEqual([0]);
	});

	test('note with dimension 1 should deliver to dimension 0 and 1', () => {
		const note = { dimension: 1 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note);
		expect(result).toEqual([0, 1]);
	});

	test('note with dimension 999 should deliver to dimension 0 and 999', () => {
		const note = { dimension: 999 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note);
		expect(result).toEqual([0, 999]);
	});

	test('note with dimension 1000 (private) should deliver to dimension 1000 only', () => {
		const note = { dimension: 1000 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note);
		expect(result).toEqual([1000]);
	});

	test('note with dimension 1001 (private) should deliver to dimension 1001 only', () => {
		const note = { dimension: 1001 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note);
		expect(result).toEqual([1001]);
	});

	test('note in dimension 1 replying to dimension 2 should deliver to dimension 0, 1, and 2', () => {
		const note = { dimension: 1 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note, 2);
		expect(result).toEqual([0, 1, 2]);
	});

	test('note in dimension 1000 (private) replying to dimension 1 should deliver to dimension 1 and 1000 only', () => {
		const note = { dimension: 1000 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note, 1);
		expect(result).toEqual([1, 1000]);
	});

	test('note in dimension 1 replying to dimension 1000 (private) should deliver to dimension 0, 1, and 1000', () => {
		const note = { dimension: 1 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note, 1000);
		expect(result).toEqual([0, 1, 1000]);
	});

	test('note in dimension 1000 (private) replying to dimension 1001 (private) should deliver to dimension 1000 and 1001 only', () => {
		const note = { dimension: 1000 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note, 1001);
		expect(result).toEqual([1000, 1001]);
	});

	test('note in dimension 1 renoting dimension 2 should deliver to dimension 0, 1, and 2', () => {
		const note = { dimension: 1 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note, undefined, 2);
		expect(result).toEqual([0, 1, 2]);
	});

	test('note in dimension 1000 (private) renoting dimension 1 should deliver to dimension 1 and 1000 only', () => {
		const note = { dimension: 1000 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note, undefined, 1);
		expect(result).toEqual([1, 1000]);
	});

	test('note in dimension 1 replying to same dimension should deliver to dimension 0 and 1 only', () => {
		const note = { dimension: 1 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note, 1);
		expect(result).toEqual([0, 1]);
	});

	test('note in dimension 0 replying to dimension 1 should deliver to dimension 0 and 1', () => {
		const note = { dimension: 0 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note, 1);
		expect(result).toEqual([0, 1]);
	});

	test('note in dimension 0 replying to dimension 1000 (private) should deliver to dimension 0 and 1000', () => {
		const note = { dimension: 0 } as MiNoteWithDimension;
		const result = getDeliverTargetDimensions(note, 1000);
		expect(result).toEqual([0, 1000]);
	});
});
