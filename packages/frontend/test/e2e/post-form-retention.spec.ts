/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { test, expect } from './fixtures.js';
import { api } from './shared.js';
import { BASE_URL, registerUser, resetState, signIn } from './utils.js';
import type { RegisteredUser } from './utils.js';
import type { Page, Route } from 'playwright';

function form(page: Page) {
	return page.locator('div:has(> header [data-testid="post-form-submit"])');
}

async function closeForm(page: Page) {
	await page.getByTestId('post-form-text').click();
	await page.getByTestId('post-form-text').press('Escape');
	await expect(page.getByTestId('post-form-text')).toHaveCount(0);
}

test.describe('投稿フォームの入力保持', () => {
	let admin: RegisteredUser;

	test.beforeEach(async ({ page }) => {
		await resetState();
		admin = await registerUser('admin', 'pass', true);
		await api(BASE_URL, 'i/registry/set', {
			i: admin.token, scope: ['client', 'base'], key: 'accountSetupWizard', value: -1,
		});
		await signIn(page, 'admin', 'pass');
		await expect(page.getByTestId('open-post-form')).toBeVisible();
	});

	test('閉じて開き直しても本文とCWを保持し、サーバー下書きは作らない', async ({ page }) => {
		const draftRequests: string[] = [];
		page.on('request', request => {
			if (/\/api\/notes\/drafts\/(create|update)$/.test(new URL(request.url()).pathname)) {
				draftRequests.push(request.url());
			}
		});
		await page.getByTestId('open-post-form').click();
		await page.getByTestId('post-form-text').fill('閉じても残す本文');
		await form(page).locator('button:has(> i.ti-eye-off)').click();
		await page.getByPlaceholder(/注釈|Content warning/).fill('閉じても残す注釈');
		await form(page).getByRole('button', { name: /パブリック|Public/ }).click();
		await page.locator('button[data-index="2"]').click();
		await closeForm(page);
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('閉じても残す本文');
		await expect(page.getByPlaceholder(/注釈|Content warning/)).toBeVisible();
		await expect(page.getByPlaceholder(/注釈|Content warning/)).toHaveValue('閉じても残す注釈');
		await expect(form(page).getByRole('button', { name: /ホーム|Home/ })).toBeVisible();
		await closeForm(page);
		await page.reload();
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('閉じても残す本文');
		expect(draftRequests).toEqual([]);
	});

	test('通常投稿と返信先ごとに入力を分ける', async ({ page }) => {
		const first = await api(BASE_URL, 'notes/create', { i: admin.token, text: '返信先その1' });
		const second = await api(BASE_URL, 'notes/create', { i: admin.token, text: '返信先その2' });
		await page.getByTestId('open-post-form').click();
		await page.getByTestId('post-form-text').fill('通常投稿の続き');
		await closeForm(page);
		for (const [note, text] of [[first, '返信その1の続き'], [second, '返信その2の続き']] as const) {
			await page.goto(`/notes/${note.createdNote.id}`);
			await page.locator('article footer button:has(> i.ti-arrow-back-up)').click();
			await expect(page.getByTestId('post-form-text')).toHaveValue('');
			await page.getByTestId('post-form-text').fill(text);
			await closeForm(page);
		}
		await page.goto(`/notes/${first.createdNote.id}`);
		await page.locator('article footer button:has(> i.ti-arrow-back-up)').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('返信その1の続き');
		await closeForm(page);
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('通常投稿の続き');
	});

	test('投稿成功またはリセットした入力は復元しない', async ({ page }) => {
		await page.getByTestId('open-post-form').click();
		await page.getByTestId('post-form-text').fill('投稿済みの本文');
		const posted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/notes/create');
		await page.getByTestId('post-form-submit').click();
		expect((await posted).ok()).toBe(true);
		await expect(page.getByTestId('post-form-text')).toHaveCount(0);
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('');
		await page.getByTestId('post-form-text').fill('リセットする本文');
		await form(page).locator('button:has(> i.ti-dots)').click();
		await page.getByRole('menuitem', { name: /リセット|Reset/ }).click();
		await page.getByTestId('modal-dialog-ok').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('');
		await closeForm(page);
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('');
		await page.getByTestId('post-form-text').fill('リセットする本文');
		await closeForm(page);
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('リセットする本文');
	});

	test('明示的な下書き保存は開き直しても同じ下書きを更新する', async ({ page }) => {
		await page.getByTestId('open-post-form').click();
		await page.getByTestId('post-form-text').fill('サーバーへ保存する本文');
		await form(page).locator('button:has(> i.ti-dots)').click();
		const created = page.waitForResponse(response => new URL(response.url()).pathname === '/api/notes/drafts/create');
		await page.getByRole('menuitem', { name: /下書きへ保存|Save to draft/ }).click();
		const createdDraft = (await (await created).json()).createdDraft;
		await closeForm(page);
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('サーバーへ保存する本文');
		await page.getByTestId('post-form-text').fill('更新した本文');
		await form(page).locator('button:has(> i.ti-dots)').click();
		const updated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/notes/drafts/update');
		await page.getByRole('menuitem', { name: /下書きへ保存|Save to draft/ }).click();
		expect((await (await updated).json()).updatedDraft.id).toBe(createdDraft.id);
		const drafts = await api(BASE_URL, 'notes/drafts/list', { i: admin.token, scheduled: false });
		expect(drafts.map((draft: { id: string; text: string }) => ({ id: draft.id, text: draft.text })))
			.toEqual([{ id: createdDraft.id, text: '更新した本文' }]);
	});

	test('同じ端末でアカウントを変えても他人の入力を復元しない', async ({ page }) => {
		const alice = await registerUser('alice', 'pass');
		await api(BASE_URL, 'i/registry/set', {
			i: alice.token, scope: ['client', 'base'], key: 'accountSetupWizard', value: -1,
		});
		await page.getByTestId('open-post-form').click();
		await page.getByTestId('post-form-text').fill('管理者だけの入力');
		await closeForm(page);
		for (const [user, expected, text] of [[alice, '', 'aliceだけの入力'], [admin, '管理者だけの入力', null]] as const) {
			const account = await api(BASE_URL, 'i', { i: user.token });
			await page.evaluate(value => localStorage.setItem('account', JSON.stringify(value)), { ...account, token: user.token });
			await page.reload();
			await page.getByTestId('open-post-form').click();
			await expect(page.getByTestId('post-form-text')).toHaveValue(expected);
			if (text != null) await page.getByTestId('post-form-text').fill(text);
			await closeForm(page);
		}
	});

	test('ioの次元・投稿言語などの設定も復元した投稿へ引き継ぐ', async ({ page }) => {
		await page.getByTestId('open-post-form').click();
		await page.getByTestId('post-form-text').fill('io設定を持つ本文');
		await closeForm(page);
		await page.evaluate(accountId => {
			const key = `postFormState:${JSON.stringify([accountId, null, null, null])}`;
			const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
			if (saved == null) throw new Error('投稿フォームの入力が保存されていません');
			localStorage.setItem(key, JSON.stringify({
				...saved,
				dimension: 1000,
				postingLang: 'ko-KR',
				visibility: 'home',
				localOnly: false,
				reactionAcceptance: 'likeOnly',
				noExtractMentions: true,
				noExtractHashtags: true,
				noExtractEmojis: true,
				withHashtags: true,
				hashtags: '継続',
				poll: { choices: ['赤', '青'], multiple: true, expiresAt: null, expiredAfter: null },
			}));
		}, admin.id);
		await page.reload();
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('io設定を持つ本文');
		await expect(form(page).getByRole('button', { name: /ホーム|Home/ })).toBeVisible();
		const posted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/notes/create');
		await page.getByTestId('post-form-submit').click();
		const response = await posted;
		expect(response.ok()).toBe(true);
		expect(response.request().postDataJSON()).toMatchObject({
			text: 'io設定を持つ本文 #継続',
			dimension: 1000,
			lang: 'ko-KR',
			visibility: 'home',
			localOnly: true,
			reactionAcceptance: 'likeOnly',
			noExtractMentions: true,
			noExtractHashtags: true,
			noExtractEmojis: true,
			poll: { choices: ['赤', '青'], multiple: true, expiresAt: null, expiredAfter: null },
		});
	});

	test('投稿通信に失敗しても開き直されたフォームへ本文とCWを戻す', async ({ page }) => {
		await page.route('**/api/notes/create', route => route.fulfill({
			status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'テスト用の通信失敗', id: 'test-error' } },
		}), { times: 1 });
		await page.getByTestId('open-post-form').click();
		await page.getByTestId('post-form-text').fill('通信に失敗しても残す本文');
		await form(page).locator('button:has(> i.ti-eye-off)').click();
		await page.getByPlaceholder(/注釈|Content warning/).fill('通信に失敗しても残す注釈');
		await page.getByTestId('post-form-submit').click();
		await page.getByTestId('modal-dialog-ok').click();
		await expect(page.getByTestId('post-form-text')).toHaveCount(1);
		await expect(page.getByTestId('post-form-text')).toHaveValue('通信に失敗しても残す本文');
		await expect(page.getByPlaceholder(/注釈|Content warning/)).toBeVisible();
		await expect(page.getByPlaceholder(/注釈|Content warning/)).toHaveValue('通信に失敗しても残す注釈');
	});

	test('前の投稿が遅れて成功しても次に入力した本文を消さない', async ({ page }) => {
		const pending = new Promise<Route>(resolve => {
			void page.route('**/api/notes/create', route => resolve(route));
		});
		await page.getByTestId('open-post-form').click();
		await page.getByTestId('post-form-text').fill('先に送信する本文');
		await page.getByTestId('post-form-submit').click();
		const request = await pending;
		await expect(page.getByTestId('post-form-text')).toHaveCount(0);
		await page.getByTestId('open-post-form').click();
		await page.getByTestId('post-form-text').fill('応答を待たずに書いた次の本文');
		await closeForm(page);
		const posted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/notes/create');
		await request.fulfill({ status: 204 });
		await posted;
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('応答を待たずに書いた次の本文');
	});

	test('指定公開の下書きを復元して閉じ直しても宛先と返信先を変えない', async ({ page }) => {
		const alice = await registerUser('alice', 'pass');
		const target = await api(BASE_URL, 'notes/create', {
			i: alice.token, text: '管理者宛ての非公開投稿', visibility: 'specified', visibleUserIds: [admin.id],
		});
		await api(BASE_URL, 'notes/drafts/create', {
			i: admin.token, text: 'aliceだけへの返信', visibility: 'specified', visibleUserIds: [alice.id], replyId: target.createdNote.id,
		});
		await page.getByTestId('open-post-form').click();
		await form(page).locator('button:has(> i.ti-pencil-minus)').click();
		await page.getByRole('menuitem', { name: /下書き一覧|Draft list/ }).click();
		await page.getByRole('button', { name: /復元|Restore/ }).click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('aliceだけへの返信');
		await closeForm(page);
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('aliceだけへの返信');
		const posted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/notes/create');
		await page.getByTestId('post-form-submit').click();
		const response = await posted;
		expect(response.ok()).toBe(true);
		expect(response.request().postDataJSON()).toMatchObject({
			text: 'aliceだけへの返信', visibility: 'specified', visibleUserIds: [alice.id], replyId: target.createdNote.id,
		});
	});

	test('保存元の投稿アカウントが利用できなくても閉じるだけでは入力を消さない', async ({ page }) => {
		await page.getByTestId('open-post-form').click();
		await page.getByTestId('post-form-text').fill('別アカウントの未送信本文');
		await closeForm(page);
		const saved = await page.evaluate(accountId => {
			const key = `postFormState:${JSON.stringify([accountId, null, null, null])}`;
			const state = JSON.parse(localStorage.getItem(key) ?? 'null');
			if (state == null) throw new Error('投稿フォームの入力が保存されていません');
			const value = JSON.stringify({ ...state, postAccountId: 'missing-user' });
			localStorage.setItem(key, value);
			return { key, value };
		}, admin.id);
		await page.getByTestId('open-post-form').click();
		await expect(page.getByTestId('post-form-text')).toHaveValue('');
		await closeForm(page);
		expect(await page.evaluate(key => localStorage.getItem(key), saved.key)).toBe(saved.value);
	});
});
