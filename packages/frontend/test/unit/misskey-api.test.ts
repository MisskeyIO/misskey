/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, test, vi } from 'vitest';
import { misskeyApi } from '@/utility/misskey-api.js';

const state = vi.hoisted(() => ({ account: null as { token: string } | null }));

vi.mock('@/i.js', () => ({ get $i() { return state.account; } }));
vi.mock('@/instance.js', () => ({ instance: {} }));

afterEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
});

test.each([
	{ signedIn: true, token: undefined, credential: 'logged-in-token' },
	{ signedIn: true, token: null, credential: null },
	{ signedIn: true, token: '', credential: '' },
	{ signedIn: true, token: 'explicit-token', credential: 'explicit-token' },
	{ signedIn: false, token: undefined, credential: undefined },
	{ signedIn: false, token: null, credential: null },
	{ signedIn: false, token: '', credential: '' },
	{ signedIn: false, token: 'explicit-token', credential: 'explicit-token' },
])('ログイン=$signedIn、token=$token の認証指定をヘッダーと本文で揃える', async ({ signedIn, token, credential }) => {
	state.account = signedIn ? { token: 'logged-in-token' } : null;
	const fetch = vi.spyOn(window, 'fetch').mockClear().mockResolvedValueOnce(new Response('{}', { status: 200 }));
	await misskeyApi('meta', { detail: true }, token, undefined, 'auth-test');
	expect(fetch).toHaveBeenCalledOnce();
	const options = fetch.mock.calls[0][1]!;
	const headers = new Headers(options.headers);
	expect(headers.get('Authorization')).toBe(credential ? `Bearer ${credential}` : 'anonymous');
	expect(JSON.parse(String(options.body))).toStrictEqual(credential === undefined ? { detail: true } : { detail: true, i: credential });
	expect(headers.get('X-Client-Transaction-Id')).toMatch(/^[0-9a-f]{32}-auth-test-[0-9a-f]{32}$/);
});
