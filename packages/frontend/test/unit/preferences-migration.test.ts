/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test, vi } from 'vitest';
import { host } from '@@/js/config.js';
import { PreferencesManager } from '@/preferences/manager.js';
import type { PossiblyNonNormalizedPreferencesProfile, StorageProvider } from '@/preferences/manager.js';
import * as os from '@/os.js';

vi.mock('@/os.js', () => ({ select: vi.fn(), waiting: () => vi.fn() }));

function createStorage(preferences: PossiblyNonNormalizedPreferencesProfile['preferences']) {
	const profile: PossiblyNonNormalizedPreferencesProfile = {
		id: 'production-profile',
		version: '2025.4.1-io.12b',
		type: 'main',
		modifiedAt: 1,
		name: '本番設定',
		preferences,
	};
	return {
		load: () => profile,
		save: vi.fn(),
		cloudGet: vi.fn().mockResolvedValue(null),
		cloudGetBulk: vi.fn().mockResolvedValue({}),
		cloudSet: vi.fn().mockResolvedValue(undefined),
	} satisfies StorageProvider;
}

test.each([false, true])('2025.4の通信節約設定とio設定を保持する（節約: %s）', async (urlPreview) => {
	const scope = { server: host, account: 'user' };
	const sound = { type: 'syuilo/n-ea', volume: 0.4 };
	const dataSaver = { media: true, avatar: true, urlPreview, code: false };
	const storage = createStorage({
		dataSaver: [[{}, dataSaver, {}]],
		dimension: [[{}, 0, {}], [scope, 1001, { sync: true }]],
		hideMutedNotes: [[{}, true, {}]],
		'sound.on.note': [[{}, sound, {}]],
	});
	const manager = new PreferencesManager(storage, { id: 'user' });
	await manager.cloudReady;

	expect(manager.s.dataSaver).toEqual({ media: true, avatar: true, urlPreviewThumbnail: urlPreview, disableUrlPreview: false, code: false });
	expect(manager.s.dimension).toBe(1001);
	expect(manager.profile.preferences.dimension).toEqual([[{}, 0, {}], [scope, 1001, { sync: true }]]);
	expect(manager.s.hideMutedNotes).toBe(true);
	expect(manager.s['sound.on.note']).toEqual(sound);
	expect(dataSaver).toHaveProperty('urlPreview', urlPreview);
	expect(storage.save).toHaveBeenCalled();
});

test('新しい設定値と各アカウントの保存先を上書きしない', async () => {
	const current = { media: false, avatar: false, urlPreviewThumbnail: false, disableUrlPreview: true, code: true };
	const scope = { server: host, account: 'user' };
	const storage = createStorage({
		dataSaver: [[{}, { ...current, urlPreview: true }, {}], [scope, { media: true, avatar: false, urlPreview: true, code: false }, {}]],
	});
	const manager = new PreferencesManager(storage, null);
	await manager.cloudReady;

	expect(manager.s.dataSaver).toEqual(current);
	expect(manager.profile.preferences.dataSaver[1]).toEqual([
		scope, { media: true, avatar: false, urlPreviewThumbnail: true, disableUrlPreview: false, code: false }, {},
	]);
});

test('同期済みの旧クラウド設定にも同じ変換を適用する', async () => {
	const current = { media: false, avatar: false, urlPreviewThumbnail: false, disableUrlPreview: false, code: false };
	const storage = createStorage({ dataSaver: [[{}, current, { sync: true }]] });
	storage.cloudGetBulk.mockResolvedValue({ dataSaver: { media: true, avatar: false, urlPreview: true, code: true } });
	const manager = new PreferencesManager(storage, null);
	await manager.cloudReady;

	expect(manager.s.dataSaver).toEqual({ media: true, avatar: false, urlPreviewThumbnail: true, disableUrlPreview: false, code: true });
	expect(manager.profile.preferences.dataSaver[0][2]).toEqual({ sync: true });
});

test('同期を再開するときも旧値と新値を同じ設定として扱う', async () => {
	const current = { media: false, avatar: false, urlPreviewThumbnail: true, disableUrlPreview: false, code: false };
	const storage = createStorage({ dataSaver: [[{}, current, {}]] });
	storage.cloudGet.mockResolvedValue({ value: { media: false, avatar: false, urlPreview: true, code: false } });
	const manager = new PreferencesManager(storage, null);
	await manager.cloudReady;
	await manager.enableSync('dataSaver');

	expect(os.select).not.toHaveBeenCalled();
	expect(storage.cloudSet).toHaveBeenCalledWith({ key: 'dataSaver', scope: {}, value: current });
	expect(manager.isSyncEnabled('dataSaver')).toBe(true);
});
