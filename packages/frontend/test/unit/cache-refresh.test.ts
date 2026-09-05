/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fetchCustomEmojis } from '@/custom-emojis.js';
import { fetchInstance } from '@/instance.js';

const mocks = vi.hoisted(() => ({
	post: vi.fn(),
	get: vi.fn(),
	read: vi.fn(),
	set: vi.fn(),
	exist: vi.fn(),
}));

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.post, misskeyApiGet: mocks.get }));
vi.mock('@/utility/idb-proxy.js', () => ({ get: mocks.read, set: mocks.set, exist: mocks.exist }));

beforeEach(() => {
	vi.resetAllMocks();
	window.localStorage.clear();
	mocks.set.mockResolvedValue(undefined);
	mocks.exist.mockResolvedValue(false);
});

afterEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
});

test('絵文字本体と更新日時を順番に保存し、両方の完了まで待つ', async () => {
	const emojis = [{ name: 'test', aliases: [], url: '/emoji/test.webp' }];
	const body = Promise.withResolvers<void>();
	const timestamp = Promise.withResolvers<void>();
	const signal = new AbortController().signal;
	mocks.post.mockResolvedValue({ emojis });
	mocks.set.mockReturnValueOnce(body.promise).mockReturnValueOnce(timestamp.promise);
	let finished = false;
	const refreshing = fetchCustomEmojis(true, signal).then(() => { finished = true; });
	await vi.waitFor(() => expect(mocks.set).toHaveBeenCalledOnce());
	expect(mocks.post).toHaveBeenCalledWith('emojis', {}, undefined, signal);
	expect(mocks.get).not.toHaveBeenCalled();
	expect(mocks.set.mock.calls[0]).toEqual(['emojis', emojis]);
	expect(finished).toBe(false);
	body.resolve();
	await vi.waitFor(() => expect(mocks.set).toHaveBeenCalledTimes(2));
	expect(mocks.set.mock.calls[1]).toEqual(['lastEmojisFetchedAt', expect.any(Number)]);
	expect(finished).toBe(false);
	timestamp.resolve();
	await refreshing;
	expect(finished).toBe(true);
});

test('絵文字本体の保存に失敗したら更新日時を進めない', async () => {
	const error = new Error('保存失敗');
	mocks.post.mockResolvedValue({ emojis: [] });
	mocks.set.mockRejectedValueOnce(error);
	await expect(fetchCustomEmojis(true)).rejects.toBe(error);
	expect(mocks.set.mock.calls).toEqual([['emojis', []]]);
});

test('更新日時の保存失敗も呼び出し元へ返す', async () => {
	const error = new Error('保存失敗');
	mocks.post.mockResolvedValue({ emojis: [] });
	mocks.set.mockResolvedValueOnce(undefined).mockRejectedValueOnce(error);
	await expect(fetchCustomEmojis(true)).rejects.toBe(error);
});

test('通常の絵文字取得はGETと中断用のsignalを使う', async () => {
	const signal = new AbortController().signal;
	mocks.get.mockResolvedValue({ emojis: [] });
	await fetchCustomEmojis(false, signal);
	expect(mocks.get).toHaveBeenCalledWith('emojis', {}, 'misskey', signal);
	expect(mocks.post).not.toHaveBeenCalled();
});

test.each([true, false])('サーバー情報の強制更新=%sでもsignalを渡し、取得方法を維持する', async (force) => {
	const signal = new AbortController().signal;
	const request = force ? mocks.post : mocks.get;
	request.mockResolvedValue({ version: '検査用' });
	await fetchInstance(force, signal);
	expect(request).toHaveBeenCalledWith('meta', { detail: true }, undefined, signal);
	expect(force ? mocks.get : mocks.post).not.toHaveBeenCalled();
	expect(JSON.parse(window.localStorage.getItem('instance')!).version).toBe('検査用');
});

test('GETを中断するとfetchへ伝わり、通信中の件数が元に戻る', async () => {
	const { misskeyApiGet, pendingApiRequestsCount } = await vi.importActual<typeof import('@/utility/misskey-api.js')>('@/utility/misskey-api.js');
	const controller = new AbortController();
	const fetch = vi.spyOn(window, 'fetch').mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
		options?.signal?.addEventListener('abort', () => reject(new DOMException('中断', 'AbortError')), { once: true });
	}));
	const count = pendingApiRequestsCount.value;
	const request = misskeyApiGet('emojis', {}, 'misskey', controller.signal);
	expect(pendingApiRequestsCount.value).toBe(count + 1);
	expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'GET', signal: controller.signal }));
	controller.abort();
	await expect(request).rejects.toMatchObject({ name: 'AbortError' });
	expect(pendingApiRequestsCount.value).toBe(count);
});
