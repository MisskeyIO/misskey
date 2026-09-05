/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import type { entities } from 'misskey-js';
import { useNote } from '@/composables/use-note.js';
import { getNoteMenu, getRenoteMenu } from '@/utility/get-note-menu.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { reactionPicker } from '@/utility/reaction-picker.js';
import * as os from '@/os.js';

const account = vi.hoisted(() => ({ id: 'me', mutedWords: [], policies: { canUseReaction: true } }));
vi.mock('@/i.js', () => ({ $i: account }));
vi.mock('@/plugin.js', () => ({ getPluginHandlers: () => [] }));
vi.mock('@/events.js', () => ({ useGlobalEvent: vi.fn(), globalEvents: { emit: vi.fn() } }));
vi.mock('@/composables/use-note-capture.js', () => ({
	useNoteCapture: ({ note }: { note: entities.Note }) => ({ $note: note, subscribe: vi.fn() }),
	noteEvents: { emit: vi.fn() },
}));
vi.mock('@/composables/use-tooltip.js', () => ({ useTooltip: vi.fn() }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin: vi.fn().mockResolvedValue(true) }));
vi.mock('@/utility/show-moved-dialog.js', () => ({ showMovedDialog: vi.fn() }));
vi.mock('@/utility/sound.js', () => ({ playMisskeySfx: vi.fn() }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement: vi.fn() }));
vi.mock('@/utility/reaction-picker.js', () => ({ reactionPicker: { show: vi.fn() } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn().mockResolvedValue({}), misskeyApiGet: vi.fn() }));
vi.mock('@/utility/get-note-menu.js', () => ({
	getRenoteMenu: vi.fn(() => ({ menu: [] })),
	getNoteMenu: vi.fn(() => ({ menu: [], cleanup: vi.fn() })),
}));
vi.mock('@/os.js', () => ({ post: vi.fn().mockResolvedValue(undefined), popupMenu: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/components/MkUsersTooltip.vue', () => ({ default: {} }));
vi.mock('@/components/MkReactionsViewer.details.vue', () => ({ default: {} }));
vi.mock('@/components/MkRippleEffect.vue', () => ({ default: {} }));

const note = {
	id: 'note', userId: 'author', user: { id: 'author' }, text: '投稿',
	visibility: 'public', channel: { id: 'channel' }, reactionAcceptance: null,
	reactions: {}, reactionCount: 0, myReaction: null,
} as entities.Note;

beforeEach(() => {
	vi.clearAllMocks();
	account.policies.canUseReaction = true;
});

test('返信・リノート・メニューに表示中の次元を引き継ぐ', async () => {
	const dimension = ref<number | null>(1001);
	const actions = useNote({ note }, { renoteButton: ref(null), menuButton: ref(null) }, { tl_dimension: dimension });
	await actions.reply();
	await actions.renote();
	actions.showMenu();

	expect(os.post).toHaveBeenCalledWith({ reply: expect.objectContaining({ id: note.id }), channel: note.channel, initialDimension: 1001 });
	expect(getRenoteMenu).toHaveBeenCalledWith(expect.objectContaining({ postFormDimension: 1001 }));
	expect(getNoteMenu).toHaveBeenCalledWith(expect.objectContaining({ postFormDimension: 1001 }));

	dimension.value = 0;
	await actions.reply();
	expect(os.post).toHaveBeenLastCalledWith(expect.objectContaining({ initialDimension: 0 }));
});

test.each([false, true])('ロールのリアクション利用権限を維持する（許可: %s）', async (canUseReaction) => {
	account.policies.canUseReaction = canUseReaction;
	await useNote({ note }).react();

	if (canUseReaction) {
		expect(reactionPicker.show).toHaveBeenCalledOnce();
		expect(misskeyApi).not.toHaveBeenCalled();
	} else {
		expect(misskeyApi).toHaveBeenCalledWith('notes/reactions/create', { noteId: note.id, reaction: '❤️' });
		expect(reactionPicker.show).not.toHaveBeenCalled();
	}
});
