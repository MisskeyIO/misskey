/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import './init';
import type { entities } from 'misskey-js';
import type { MenuButton } from '@/types/menu.js';
import { getNoteMenu } from '@/utility/get-note-menu.js';
import { globalEvents } from '@/events.js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';

vi.mock('@/i.js', () => ({ $i: { id: 'me', policies: {} } }));
vi.mock('@/instance.js', () => ({ instance: {} }));
vi.mock('@/store.js', () => ({ store: {} }));
vi.mock('@/plugin.js', () => ({ getPluginHandlers: () => [] }));
vi.mock('@/utility/get-user-menu.js', () => ({ getUserMenu: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn().mockResolvedValue({}) }));
vi.mock('@/os.js', () => ({
	confirm: vi.fn().mockResolvedValue({ canceled: false }),
	apiWithDialog: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

test.each([false, true])('アンテナ削除は表示中の投稿IDを使う（Renote: %s）', async (isRenote) => {
	const original = { id: 'original', userId: 'author', text: '投稿' } as entities.Note;
	const note = isRenote
		? { id: 'renote', userId: 'resharer', renoteId: original.id, renote: original } as entities.Note
		: original;
	const antenna = { id: 'antenna', name: 'アンテナ' } as entities.Antenna;
	const emit = vi.spyOn(globalEvents, 'emit');
	const { menu } = getNoteMenu({ note, currentAntenna: antenna, translating: ref(false), translation: ref(null) });
	const remove = menu.find((item): item is MenuButton => 'action' in item && 'text' in item && item.text === i18n.ts.removeFromAntenna);

	assert.isDefined(remove);
	await remove.action(new MouseEvent('click'));

	expect(os.apiWithDialog).toHaveBeenCalledWith('antennas/remove-note', { antennaId: antenna.id, noteId: note.id });
	expect(emit).toHaveBeenCalledWith('noteRemovedFromAntenna', antenna.id, note.id);
});
