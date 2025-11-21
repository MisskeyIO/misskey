/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { api, post, signup, uploadUrl } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('users/notes', () => {
	let alice: misskey.entities.SignupResponse;
	let jpgNote: misskey.entities.Note;
	let pngNote: misskey.entities.Note;
	let jpgPngNote: misskey.entities.Note;

	beforeAll(async () => {
		alice = await signup({ username: 'alice' });
		const jpg = await uploadUrl(alice, 'https://media.misskeyusercontent.jp/misskey/65b25d3c-2ae4-474f-b1c0-050c8c8962e1.jpg');
		const png = await uploadUrl(alice, 'https://misskey.io/static-assets/icons/192.png');
		jpgNote = await post(alice, {
			fileIds: [jpg.id],
		});
		pngNote = await post(alice, {
			fileIds: [png.id],
		});
		jpgPngNote = await post(alice, {
			fileIds: [jpg.id, png.id],
		});
	}, 1000 * 60 * 5);

	test('withFiles', async () => {
		const res = await api('users/notes', {
			userId: alice.id,
			withFiles: true,
		}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.length, 3);
		assert.strictEqual(res.body.some((note: any) => note.id === jpgNote.id), true);
		assert.strictEqual(res.body.some((note: any) => note.id === pngNote.id), true);
		assert.strictEqual(res.body.some((note: any) => note.id === jpgPngNote.id), true);
	});
});
