/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { beforeAll, describe, test } from 'vitest';
import { api, page, signup, successfulApiCall } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('ページの公開範囲', () => {
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;
	let publicPage: misskey.entities.Page;
	let privatePage: misskey.entities.Page;

	beforeAll(async () => {
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
		publicPage = await page(alice, { name: 'public-page' });
		privatePage = await page(alice, { name: 'private-page', visibility: 'private' });
	}, 1000 * 60 * 2);

	test('非公開ページは所有者だけが取得できる。', async () => {
		await successfulApiCall({
			endpoint: 'pages/show',
			parameters: { pageId: privatePage.id },
			user: alice,
		});

		for (const user of [bob, undefined]) {
			const res = await api('pages/show', { pageId: privatePage.id }, user);
			assert.strictEqual(res.status, 400);
			assert.strictEqual((res.body as any).error.code, 'NO_SUCH_PAGE');
		}
	});

	test('非公開ページは第三者のpinnedPageへ含めない。', async () => {
		await successfulApiCall({
			endpoint: 'i/update',
			parameters: { pinnedPageId: privatePage.id },
			user: alice,
		});

		const owner = await api('users/show', { userId: alice.id }, alice);
		assert.strictEqual(owner.status, 200);
		assert.strictEqual(owner.body.pinnedPageId, privatePage.id);
		assert.strictEqual(owner.body.pinnedPage?.id, privatePage.id);

		for (const user of [bob, undefined]) {
			const res = await api('users/show', { userId: alice.id }, user);
			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.pinnedPageId, null);
			assert.strictEqual(res.body.pinnedPage, null);
		}
	});

	test('公開ページは第三者のpinnedPageへ含める。', async () => {
		await successfulApiCall({
			endpoint: 'i/update',
			parameters: { pinnedPageId: publicPage.id },
			user: alice,
		});

		const res = await api('users/show', { userId: alice.id }, bob);
		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.pinnedPageId, publicPage.id);
		assert.strictEqual(res.body.pinnedPage?.id, publicPage.id);
	});

	test('非公開ページへの操作は第三者に存在を示さず拒否する。', async () => {
		const responses = await Promise.all([
			api('pages/like', { pageId: privatePage.id }, bob),
			api('pages/unlike', { pageId: privatePage.id }, bob),
			api('page-push', { pageId: privatePage.id, event: 'test', var: null }, bob),
		]);

		for (const res of responses) {
			assert.strictEqual(res.status, 400);
			assert.strictEqual((res.body as any).error.code, 'NO_SUCH_PAGE');
		}
	});

	test('公開ページへの操作は従来どおり利用できる。', async () => {
		await successfulApiCall({
			endpoint: 'pages/like',
			parameters: { pageId: publicPage.id },
			user: bob,
		});
		await successfulApiCall({
			endpoint: 'pages/unlike',
			parameters: { pageId: publicPage.id },
			user: bob,
		});
		await successfulApiCall({
			endpoint: 'page-push',
			parameters: { pageId: publicPage.id, event: 'test', var: null },
			user: bob,
		});
	});
});
