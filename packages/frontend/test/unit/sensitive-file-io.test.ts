/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, expect, test, vi } from 'vitest';
import type { entities } from 'misskey-js';
import { canRevealFile, isFileBlocked, shouldHideFileByDefault } from '@/utility/sensitive-file.js';
import { pleaseLogin } from '@/utility/please-login.js';
import { requestSensitiveContentConsent } from '@/utility/sensitive-content-consent.js';
import * as os from '@/os.js';

const state = vi.hoisted(() => ({
	account: { id: 'me' } as { id: string } | null,
	consent: { value: null as boolean | null },
	preferences: {
		nsfw: 'ignore' as 'ignore' | 'respect' | 'force',
		dataSaver: { media: false },
		confirmWhenRevealingSensitiveMedia: false,
	},
}));

vi.mock('@/i.js', () => ({ get $i() { return state.account; } }));
vi.mock('@/preferences.js', () => ({ prefer: { s: state.preferences } }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin: vi.fn().mockResolvedValue(false) }));
vi.mock('@/utility/sensitive-content-consent.js', () => ({
	sensitiveContentConsent: state.consent,
	requestSensitiveContentConsent: vi.fn(),
}));
vi.mock('@/os.js', () => ({ confirm: vi.fn() }));

const sensitive = { isSensitive: true } as entities.DriveFile;
const ordinary = { isSensitive: false } as entities.DriveFile;

beforeEach(() => {
	vi.clearAllMocks();
	state.account = { id: 'me' };
	state.consent.value = null;
	state.preferences.nsfw = 'ignore';
	state.preferences.dataSaver.media = false;
	state.preferences.confirmWhenRevealingSensitiveMedia = false;
	vi.mocked(requestSensitiveContentConsent).mockImplementation(async () => state.consent.value ?? false);
	vi.mocked(os.confirm).mockResolvedValue({ canceled: false });
});

test.each([null, false, true])('同意状態 %s を表示設定より優先する', (consent) => {
	state.consent.value = consent;
	expect(isFileBlocked(sensitive)).toBe(consent === false);
	expect(shouldHideFileByDefault(sensitive)).toBe(consent !== true);
	expect(shouldHideFileByDefault(sensitive, true)).toBe(consent !== true);
});

test('未ログインでは同意確認に進まずログインを案内する', async () => {
	state.account = null;
	expect(await canRevealFile(sensitive)).toBe(false);
	expect(pleaseLogin).toHaveBeenCalledOnce();
	expect(requestSensitiveContentConsent).not.toHaveBeenCalled();
	expect(os.confirm).not.toHaveBeenCalled();
});

test.each([null, false])('未承諾のままなら表示しない（同意状態: %s）', async (consent) => {
	state.consent.value = consent;
	expect(await canRevealFile(sensitive)).toBe(false);
	expect(requestSensitiveContentConsent).toHaveBeenCalledOnce();
	expect(os.confirm).not.toHaveBeenCalled();
});

test.each([false, true])('新たに同意しても個別確認の結果を守る（キャンセル: %s）', async (canceled) => {
	state.preferences.confirmWhenRevealingSensitiveMedia = true;
	vi.mocked(requestSensitiveContentConsent).mockImplementation(async () => {
		state.consent.value = true;
		return true;
	});
	vi.mocked(os.confirm).mockResolvedValue({ canceled });
	expect(await canRevealFile(sensitive)).toBe(!canceled);
	expect(os.confirm).toHaveBeenCalledOnce();
});

test('同意済みで個別確認が無効なら追加確認せず表示する', async () => {
	state.consent.value = true;
	expect(await canRevealFile(sensitive)).toBe(true);
	expect(pleaseLogin).not.toHaveBeenCalled();
	expect(os.confirm).not.toHaveBeenCalled();
});

test('非センシティブファイルは同意やログインを要求しない', async () => {
	state.account = null;
	state.consent.value = false;
	state.preferences.confirmWhenRevealingSensitiveMedia = true;
	expect(isFileBlocked(ordinary)).toBe(false);
	expect(shouldHideFileByDefault(ordinary)).toBe(false);
	expect(await canRevealFile(ordinary)).toBe(true);
	expect(pleaseLogin).not.toHaveBeenCalled();
	expect(requestSensitiveContentConsent).not.toHaveBeenCalled();
	expect(os.confirm).not.toHaveBeenCalled();
});

test('承諾後の拒否や未選択への変更を判定へ反映する', () => {
	state.consent.value = true;
	expect(shouldHideFileByDefault(sensitive)).toBe(false);
	state.consent.value = false;
	expect(isFileBlocked(sensitive)).toBe(true);
	expect(shouldHideFileByDefault(sensitive)).toBe(true);
	state.consent.value = null;
	expect(isFileBlocked(sensitive)).toBe(false);
	expect(shouldHideFileByDefault(sensitive)).toBe(true);
});

test('同意後も強制非表示・センシティブ尊重・通信節約設定を維持する', () => {
	state.consent.value = true;
	state.preferences.nsfw = 'respect';
	expect(shouldHideFileByDefault(sensitive)).toBe(true);
	state.preferences.nsfw = 'force';
	expect(shouldHideFileByDefault(ordinary, true)).toBe(true);
	state.preferences.nsfw = 'ignore';
	state.preferences.dataSaver.media = true;
	expect(shouldHideFileByDefault(ordinary)).toBe(true);
	expect(shouldHideFileByDefault(ordinary, true)).toBe(false);
});
