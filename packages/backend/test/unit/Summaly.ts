/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createServer, type IncomingHttpHeaders } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { summaly, summalyDefaultOptions } from '@misskey-dev/summaly';

let origin: string;
let contentType: string;
let body: Buffer;
const requests: { method?: string; path: string; headers: IncomingHttpHeaders }[] = [];
const server = createServer((request, response) => {
	const path = request.url ?? '/';
	requests.push({ method: request.method, path, headers: request.headers });
	const redirects = /^\/redirect\/(\d+)$/.exec(path);
	if (redirects) {
		const remaining = Number(redirects[1]);
		response.writeHead(302, { Location: remaining > 1 ? `/redirect/${remaining - 1}` : '/page' });
	} else {
		response.writeHead(path === '/favicon.ico' ? 204 : Number(/^\/status\/(\d+)$/.exec(path)?.[1] ?? 200), {
			'Content-Type': contentType,
		});
	}
	response.end(body);
});

beforeAll(async () => {
	vi.stubEnv('SUMMALY_ALLOW_PRIVATE_IP', 'true');
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	if (address === null || typeof address === 'string') throw new Error('テスト用サーバーを起動できません');
	origin = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
	requests.length = 0;
	contentType = 'text/html';
	body = Buffer.from('<title>日本語</title>');
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
	vi.unstubAllEnvs();
});

test.each([
	['text/html; charset="SHIFT_JIS"', 'utf-8', [0x82, 0xA0], 'あ'],
	['text/html; charset=unsupported', 'shift_jis', [0x82, 0xA0], 'あ'],
	['text/html', 'windows-1252', [0x63, 0x61, 0x66, 0xE9], 'café'],
	['text/html; charset=unsupported', 'unsupported', [...Buffer.from('日本語')], '日本語'],
	['text/html; charset=shift_jis', '', [...Buffer.from('あ')], 'あ'],
	['text/html', '', [...Buffer.from('日本語')], '日本語'],
])('文字コードを Content-Type、meta、UTF-8 の順で選ぶ: %s / %s', async (type, charset, title, expected) => {
	contentType = type;
	body = Buffer.concat([
		Buffer.from(`<meta charset="${charset}"><title>`),
		Buffer.from(title),
		Buffer.from('</title>'),
	]);
	await expect(summaly(`${origin}/page`, { followRedirects: false })).resolves.toMatchObject({ title: expected });
});

test('リダイレクトは既定で 3 回まで許可する', async () => {
	await expect(summaly(`${origin}/redirect/3`)).resolves.toMatchObject({ title: '日本語', url: `${origin}/page` });
	requests.length = 0;
	await expect(summaly(`${origin}/redirect/4`)).rejects.toThrow();
	expect(requests.some(request => request.path === '/page')).toBe(false);
});

test.each([{ followRedirects: false, maxRedirects: 5 }, { maxRedirects: 0 }])('リダイレクト禁止を GET にも適用する: %j', async (options) => {
	await expect(summaly(`${origin}/redirect/1`, options)).rejects.toMatchObject({ statusCode: 302 });
	expect(requests.map(request => request.path)).toEqual(['/redirect/1']);
});

test.each([300, 404, 500])('成功以外の HTTP %i を拒否する', async (status) => {
	await expect(summaly(`${origin}/status/${status}`, { followRedirects: false })).rejects.toMatchObject({ statusCode: status });
});

test('UA と言語を HEAD と GET に適用し、次の呼出しへ設定を残さない', async () => {
	const defaults = { ...summalyDefaultOptions };
	await summaly(`${origin}/page`, { userAgent: 'Summaly-Test', lang: 'ja-JP', maxRedirects: 1 });
	const customized = requests.filter(request => request.path === '/page');
	expect(customized.map(request => request.method)).toEqual(['HEAD', 'GET']);
	for (const request of customized) {
		expect(request.headers['user-agent']).toBe('Summaly-Test');
		expect(request.headers['accept-language']).toBe('ja-JP');
	}
	expect(summalyDefaultOptions).toEqual(defaults);

	requests.length = 0;
	await expect(summaly(`${origin}/redirect/3`)).resolves.toMatchObject({ url: `${origin}/page` });
	for (const request of requests.filter(request => request.path !== '/favicon.ico')) {
		expect(request.headers['user-agent']).toBe('Mozilla/5.0 (compatible; SummalyBot/5.5.1)');
		expect(request.headers['accept-language']).toBeUndefined();
	}
	expect(summalyDefaultOptions).toEqual(defaults);
});
