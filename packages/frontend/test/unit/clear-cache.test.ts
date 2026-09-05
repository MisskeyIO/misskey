/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { clearCache } from '@/utility/clear-cache.js';
import { miLocalStorage } from '@/local-storage.js';

const mocks = vi.hoisted(() => ({
	done: vi.fn(),
	alert: vi.fn(),
	reload: vi.fn(),
	api: vi.fn(),
	del: vi.fn(),
	fetchInstance: vi.fn(),
	fetchEmojis: vi.fn(),
}));

vi.mock('@/os.js', () => ({ waiting: () => mocks.done, alert: mocks.alert }));
vi.mock('@/utility/unison-reload.js', () => ({ unisonReload: mocks.reload }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApiGet: mocks.api }));
vi.mock('@/utility/idb-proxy.js', () => ({ del: mocks.del }));
vi.mock('@/instance.js', () => ({ instance: {}, fetchInstance: mocks.fetchInstance }));
vi.mock('@/custom-emojis.js', () => ({ fetchCustomEmojis: mocks.fetchEmojis }));
vi.mock('@/theme.js', () => ({
	clearAppliedThemeCache: () => {
		for (const key of ['theme', 'themeId', 'themeCachedVersion']) window.localStorage.removeItem(key);
	},
}));

beforeEach(() => {
	vi.useFakeTimers();
	vi.resetAllMocks();
	window.localStorage.clear();
	mocks.api.mockResolvedValue(undefined);
	mocks.del.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
	window.localStorage.clear();
});

test('キャッシュだけを削除し、絵文字を再取得せずに再読込する', async () => {
	const cached = ['instance', 'instanceCachedAt', 'emojis', 'lastEmojisFetchedAt', 'theme', 'themeId', 'themeCachedVersion'] as const;
	const retained = ['account', 'drafts', 'preferences', 'gaConsent', 'sensitiveContentConsent'] as const;
	for (const key of [...cached, ...retained]) miLocalStorage.setItem(key, '検査用');
	await clearCache();
	for (const key of cached) expect(miLocalStorage.getItem(key)).toBeNull();
	for (const key of retained) expect(miLocalStorage.getItem(key)).toBe('検査用');
	expect(mocks.del.mock.calls).toEqual([['emojis'], ['lastEmojisFetchedAt']]);
	expect(mocks.api).toHaveBeenCalledOnce();
	expect(mocks.api.mock.calls[0][0]).toBe('clear-browser-cache');
	expect(mocks.fetchInstance).toHaveBeenCalledWith(true);
	expect(mocks.fetchEmojis).not.toHaveBeenCalled();
	expect(mocks.reload).toHaveBeenCalledOnce();
	expect(mocks.done).toHaveBeenCalledOnce();
	expect(mocks.alert).not.toHaveBeenCalled();
	expect(vi.getTimerCount()).toBe(0);
});

test.each(['api', 'del', 'fetchInstance'] as const)('%sの失敗時は待機を閉じ、再試行できる', async (stage) => {
	mocks[stage].mockRejectedValueOnce(new Error('検査用'));
	await expect(clearCache()).resolves.toBeUndefined();
	expect(mocks.done).toHaveBeenCalledOnce();
	expect(mocks.alert).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
	expect(mocks.reload).not.toHaveBeenCalled();
	expect(vi.getTimerCount()).toBe(0);
	await clearCache();
	expect(mocks.reload).toHaveBeenCalledOnce();
});

test.each(['api', 'del', 'fetchInstance'] as const)('%sが10秒以上かかっても中断せず、実際の完了を待つ', async (stage) => {
	const abort = vi.spyOn(AbortController.prototype, 'abort');
	let release!: () => void;
	mocks[stage].mockReturnValueOnce(new Promise<void>(resolve => { release = resolve; }));
	const clearing = clearCache();
	await vi.advanceTimersByTimeAsync(30_000);
	expect(mocks.done).not.toHaveBeenCalled();
	expect(mocks.alert).not.toHaveBeenCalled();
	expect(mocks.reload).not.toHaveBeenCalled();
	expect(abort).not.toHaveBeenCalled();
	expect(vi.getTimerCount()).toBe(0);
	release();
	await clearing;
	expect(mocks.done).toHaveBeenCalledOnce();
	expect(mocks.reload).toHaveBeenCalledOnce();
	expect(mocks.alert).not.toHaveBeenCalled();
	expect(abort).not.toHaveBeenCalled();
});
