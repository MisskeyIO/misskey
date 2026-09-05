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

test('最新情報は並列に取得し、両方の完了後にだけ再読込する', async () => {
	let finishMeta!: () => void;
	let finishEmojis!: () => void;
	mocks.fetchInstance.mockReturnValueOnce(new Promise<void>(resolve => { finishMeta = resolve; }));
	mocks.fetchEmojis.mockReturnValueOnce(new Promise<void>(resolve => { finishEmojis = resolve; }));
	const clearing = clearCache();
	await vi.advanceTimersByTimeAsync(0);
	expect(mocks.fetchInstance).toHaveBeenCalledOnce();
	expect(mocks.fetchEmojis).toHaveBeenCalledOnce();
	finishMeta();
	await vi.advanceTimersByTimeAsync(0);
	expect(mocks.reload).not.toHaveBeenCalled();
	finishEmojis();
	await clearing;
	expect(mocks.reload).toHaveBeenCalledOnce();
});

test('キャッシュだけを削除し、最新情報の取得後に再読込する', async () => {
	const cached = ['instance', 'instanceCachedAt', 'emojis', 'lastEmojisFetchedAt', 'theme', 'themeId', 'themeCachedVersion'] as const;
	const retained = ['account', 'drafts', 'preferences', 'gaConsent', 'sensitiveContentConsent'] as const;
	for (const key of [...cached, ...retained]) miLocalStorage.setItem(key, '検査用');
	await clearCache();
	for (const key of cached) expect(miLocalStorage.getItem(key)).toBeNull();
	for (const key of retained) expect(miLocalStorage.getItem(key)).toBe('検査用');
	expect(mocks.del.mock.calls).toEqual([['emojis'], ['lastEmojisFetchedAt']]);
	expect(mocks.api).toHaveBeenCalledOnce();
	expect(mocks.api.mock.calls[0][0]).toBe('clear-browser-cache');
	expect(mocks.fetchInstance).toHaveBeenCalledWith(true, expect.any(AbortSignal));
	expect(mocks.fetchEmojis).toHaveBeenCalledWith(true, expect.any(AbortSignal));
	expect(mocks.reload).toHaveBeenCalledOnce();
	expect(mocks.done).toHaveBeenCalledOnce();
	expect(mocks.alert).not.toHaveBeenCalled();
	expect(vi.getTimerCount()).toBe(0);
});

test.each(['api', 'del', 'fetchInstance', 'fetchEmojis'] as const)('%sの失敗時は待機を閉じ、再試行できる', async (stage) => {
	mocks[stage].mockRejectedValueOnce(new Error('検査用'));
	await expect(clearCache()).resolves.toBeUndefined();
	expect(mocks.done).toHaveBeenCalledOnce();
	expect(mocks.alert).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
	expect(mocks.reload).not.toHaveBeenCalled();
	expect(vi.getTimerCount()).toBe(0);
	await clearCache();
	expect(mocks.reload).toHaveBeenCalledOnce();
});

test.each(['api', 'del', 'fetchInstance', 'fetchEmojis'] as const)('%sが応答しなくても10秒で操作へ戻る', async (stage) => {
	let release!: () => void;
	mocks[stage].mockReturnValueOnce(new Promise<void>(resolve => { release = resolve; }));
	const clearing = clearCache();
	await vi.advanceTimersByTimeAsync(10_000);
	expect(mocks.done).toHaveBeenCalledOnce();
	await clearing;
	expect(mocks.alert).toHaveBeenCalledOnce();
	expect(mocks.reload).not.toHaveBeenCalled();
	if (stage !== 'del') expect(mocks.api.mock.calls[0][3].aborted).toBe(true);
	release();
	await vi.advanceTimersByTimeAsync(0);
	if (stage === 'del') expect(mocks.api).not.toHaveBeenCalled();
	expect(mocks.reload).not.toHaveBeenCalled();
});
