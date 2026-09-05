/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { test, expect } from './fixtures.js';
import { api } from './shared.js';
import { BASE_URL, registerUser, resetState, signIn } from './utils.js';

test.describe('設定からのキャッシュ削除', () => {
	test.beforeEach(async ({ page }) => {
		await resetState();
		const admin = await registerUser('admin', 'pass', true);
		await api(BASE_URL, 'i/registry/set', {
			i: admin.token, scope: ['client', 'base'], key: 'accountSetupWizard', value: -1,
		});
		await signIn(page, 'admin', 'pass');
		await expect(page.getByTestId('signin')).toHaveCount(0);
		await page.goto('/settings/profile');
		await expect(page.locator('input[max="30"]')).toBeVisible();
		await expect(page.getByRole('button', { name: /Clear cache|キャッシュをクリア/ })).toBeVisible();
	});

	test('1.2万件の絵文字を更新し、ログイン・下書き・設定の保持と二重取得なしを確認する', async ({ page }) => {
		const before = await page.evaluate(() => {
			localStorage.setItem('drafts', JSON.stringify({ cacheTest: { text: '消してはいけない下書き' } }));
			localStorage.setItem('customCss', '/* キャッシュ削除の保存確認 */');
			const account = JSON.parse(localStorage.getItem('account') ?? 'null');
			return {
				id: account.id,
				token: account.token,
				drafts: localStorage.getItem('drafts'),
				customCss: localStorage.getItem('customCss'),
				preferences: JSON.parse(localStorage.getItem('preferences') ?? 'null').preferences,
			};
		});
		expect(before.preferences).not.toBeNull();
		const emojis = Array.from({ length: 12_103 }, (_, i) => ({
			aliases: [], name: `cache_clear_test_${i}`, category: null, url: `${BASE_URL}/favicon.ico`,
		}));
		const emojiMethods: string[] = [];
		await page.route('**/api/emojis**', async route => {
			emojiMethods.push(route.request().method());
			await route.fulfill({ json: { emojis } });
		});
		const cleared = page.waitForResponse(response => new URL(response.url()).pathname === '/api/clear-browser-cache');
		await Promise.all([
			page.waitForEvent('framenavigated', frame => frame === page.mainFrame()),
			page.getByRole('button', { name: /Clear cache|キャッシュをクリア/ }).click(),
		]);
		expect((await cleared).ok()).toBe(true);
		await expect(page.getByRole('button', { name: /Clear cache|キャッシュをクリア/ })).toBeVisible();
		await expect(page.locator('body')).not.toHaveAttribute('inert');
		await expect(page.getByTestId('signin')).toHaveCount(0);
		const after = await page.evaluate(() => {
			const account = JSON.parse(localStorage.getItem('account') ?? 'null');
			return {
				id: account.id,
				token: account.token,
				drafts: localStorage.getItem('drafts'),
				customCss: localStorage.getItem('customCss'),
				preferences: JSON.parse(localStorage.getItem('preferences') ?? 'null').preferences,
			};
		});
		expect(after).toEqual(before);
		expect(emojiMethods).toEqual(['POST']);
		const storedEmojis = await page.evaluate(() => new Promise((resolve, reject) => {
			const request = indexedDB.open('keyval-store');
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const database = request.result;
				const transaction = database.transaction('keyval');
				const entry = transaction.objectStore('keyval').get('emojis');
				transaction.oncomplete = () => {
					database.close();
					resolve(entry.result);
				};
				transaction.onerror = () => {
					database.close();
					reject(transaction.error);
				};
			};
		}));
		expect(storedEmojis).toEqual(emojis);
	});

	test('10秒を超えても中断せず、処理が完了してから再読込する', async ({ page }) => {
		let navigations = 0;
		page.on('request', request => {
			if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
		});
		const response = Promise.withResolvers<void>();
		await page.route('**/api/clear-browser-cache**', async route => {
			await response.promise;
			await route.continue();
		});
		await page.clock.install();
		await Promise.all([
			page.waitForRequest(request => new URL(request.url()).pathname === '/api/clear-browser-cache'),
			page.getByRole('button', { name: /Clear cache|キャッシュをクリア/ }).click(),
		]);
		await expect(page.getByTestId('bg')).toBeVisible();
		await page.clock.fastForward(30_000);
		await expect(page.getByText(/Please try again later|もう一度お試しください。/)).toHaveCount(0);
		await expect(page.getByTestId('bg')).toBeVisible();
		expect(navigations).toBe(0);
		await page.clock.resume();
		const navigated = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
		response.resolve();
		await navigated;
		await expect(page.getByRole('button', { name: /Clear cache|キャッシュをクリア/ })).toBeVisible();
		await expect(page.locator('body')).not.toHaveAttribute('inert');
		expect(navigations).toBe(1);
	});

	for (const endpoint of ['meta', 'emojis']) {
		test(`${endpoint} の取得失敗時も画面を操作できる`, async ({ page }) => {
			let navigations = 0;
			page.on('request', request => {
				if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
			});
			await page.route(`**/api/${endpoint}**`, route => route.fulfill({
				status: 503,
				json: { error: { message: 'キャッシュ削除の通信エラー検査', code: 'INTERNAL_ERROR' } },
			}));
			await page.getByRole('button', { name: /Clear cache|キャッシュをクリア/ }).click();
			await expect(page.getByText(/Please try again later|もう一度お試しください。/)).toBeVisible();
			await expect(page.locator('body')).not.toHaveAttribute('inert');
			await page.getByTestId('modal-dialog-ok').click();
			await page.getByRole('button', { name: /Clear cache|キャッシュをクリア/ }).click({ trial: true });
			expect(navigations).toBe(0);
		});
	}
});
