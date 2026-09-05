/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { test, expect } from './fixtures.js';
import { api } from './shared.js';
import { BASE_URL, registerUser, resetState, signIn } from './utils.js';

test.describe('配信済み画面の読み込み', () => {
	test.beforeEach(async ({ page }) => {
		await resetState();
		const admin = await registerUser('admin', 'pass', true);
		await api(BASE_URL, 'i/registry/set', {
			i: admin.token,
			scope: ['client', 'base'],
			key: 'accountSetupWizard',
			value: -1,
		});
		await signIn(page, 'admin', 'pass');
		await expect(page.getByTestId('signin')).toHaveCount(0);
	});

	// 共通部品の欠落を、画面固有の要素で検出する。
	for (const [path, selector] of [
		['/admin/emojis', '.ogwlenmc .local input'],
		['/settings/profile', 'input[max="30"]'],
		['/settings/security', 'img[src="/fluent-emoji/1f510.png"]'],
		['/gallery', 'header .ti-comet'],
	]) {
		test(`${path} が表示される`, async ({ page }) => {
			await page.goto(path);
			await expect(page.locator(selector)).toBeVisible();
		});
	}

	test('認証サービスの管理入口が表示される', async ({ page }) => {
		await page.goto('/admin/security');
		await expect(page.getByTestId('folder-header').filter({ hasText: 'IndieAuth Clients' })).toBeVisible();
		await expect(page.getByTestId('folder-header').filter({ hasText: 'Single Sign-On Service Providers' })).toBeVisible();
	});
});

test('ワードミュートと非表示設定をタイムラインへ適用する', async ({ page }) => {
	await resetState();
	const admin = await registerUser('admin', 'pass', true);
	const author = await registerUser('author', 'pass');
	await api(BASE_URL, 'i/registry/set', {
		i: admin.token, scope: ['client', 'base'], key: 'accountSetupWizard', value: -1,
	});
	await api(BASE_URL, 'i/update', { i: admin.token, mutedWords: [['hidden_keyword']] });
	await page.addInitScript(() => {
		localStorage.setItem('preferences', JSON.stringify({
			id: 'mute-test', version: '2025.4.1-io.12b', type: 'main', modifiedAt: 1, name: '検査設定',
			preferences: { hideMutedNotes: [[{}, true, {}]] },
		}));
	});
	const visible = await api(BASE_URL, 'notes/create', { i: author.token, text: 'visible_note' });
	const hidden = await api(BASE_URL, 'notes/create', { i: author.token, text: 'hidden_keyword' });

	// サーバーの除外処理に頼らず、画面側のミュートも検査する。
	await page.route('**/api/notes/timeline', route => route.fulfill({
		json: [visible.createdNote, hidden.createdNote],
	}));
	await signIn(page, 'admin', 'pass');
	await expect(page.getByText('visible_note', { exact: true })).toBeVisible();
	await expect(page.getByText('hidden_keyword', { exact: true })).toHaveCount(0);
});
