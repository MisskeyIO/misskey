/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/vue';
import { defineComponent, h, nextTick, ref } from 'vue';
import MkPostForm from '@/components/MkPostForm.vue';
import { i18n } from '@/i18n.js';

const state = vi.hoisted(() => ({
	preferences: { rememberNoteVisibility: false, defaultNoteVisibility: 'home', defaultNoteLocalOnly: false, dimension: 0 },
	store: { visibility: 'followers', localOnly: false, showPreview: false, reactionAcceptance: null },
	user: { id: 'me', username: 'me', policies: { noteDraftLimit: 0, canScheduleNote: false } },
}));

vi.mock('@/preferences.js', () => ({ prefer: { s: state.preferences } }));
vi.mock('@/store.js', async () => {
	const { ref } = await import('vue');
	return { store: {
		s: state.store,
		r: { tl: ref(null), tips: ref({ postForm: true }) },
		model: (key: string) => ref(key === 'postFormWithHashtags' ? false : ''),
	} };
});
vi.mock('@/i.js', () => ({ ensureSignin: () => state.user, $i: state.user }));
vi.mock('@/instance.js', () => ({ instance: { maxNoteTextLength: 3000 } }));
vi.mock('@/plugin.js', () => ({ getPluginHandlers: () => [] }));
vi.mock('@/os.js', () => ({}));
vi.mock('@/accounts.js', () => ({}));
vi.mock('@/utility/drive.js', () => ({}));
vi.mock('@/utility/achievements.js', () => ({}));
vi.mock('@/utility/mfm-function-picker.js', () => ({}));
vi.mock('@/utility/tour.js', () => ({}));
vi.mock('@/tips.js', () => ({}));
vi.mock('@/utility/autocomplete.js', () => ({ Autocomplete: class { detach() {} } }));
vi.mock('@/composables/use-uploader.js', async () => {
	const { ref } = await import('vue');
	return { useUploader: () => ({ items: ref([]), events: { on: vi.fn() }, reset: vi.fn(), dispose: vi.fn() }) };
});
vi.mock('@/components/MkUploaderItems.vue', () => ({ default: {} }));
vi.mock('@/components/MkNotePreview.vue', () => ({ default: {} }));
vi.mock('@/components/MkPostFormAttaches.vue', () => ({ default: {} }));
vi.mock('@/components/MkPollEditor.vue', () => ({ default: {} }));
vi.mock('@/components/MkNoteSimple.vue', () => ({ default: {} }));
vi.mock('@/components/MkRippleEffect.vue', () => ({ default: {} }));

afterEach(cleanup);

test.each([
	[false, false], [false, true], [true, false], [true, true],
])('消去後も公開範囲と連合設定を維持する（記憶: %s、既定の連合無効: %s）', async (remember, defaultLocalOnly) => {
	state.preferences.rememberNoteVisibility = remember;
	state.preferences.defaultNoteLocalOnly = defaultLocalOnly;
	state.store.localOnly = !defaultLocalOnly;
	const form = ref<InstanceType<typeof MkPostForm>>();
	const result = render(defineComponent({
		setup: () => () => h(MkPostForm, { ref: form, mock: true, autofocus: false, initialText: '消去する本文' }),
	}), {
		global: {
			stubs: { MkAvatar: true, MkEllipsis: true, Mfm: true, MkAcct: true, MkTime: true, I18n: true, MkTip: true, XPostFormAttaches: true },
			directives: { tooltip: {}, 'click-anime': {} },
		},
	});
	const expectedVisibility = remember ? 'followers' : 'home';
	const expectedLocalOnly = remember ? !defaultLocalOnly : defaultLocalOnly;
	expect(result.getByText(i18n.ts._visibility[expectedVisibility])).toBeTruthy();
	expect(result.container.querySelector('.ti-rocket-off') != null).toBe(expectedLocalOnly);
	form.value?.clear();
	await nextTick();
	expect((result.getByTestId('post-form-text') as HTMLTextAreaElement).value).toBe('');
	expect(result.getByText(i18n.ts._visibility[expectedVisibility])).toBeTruthy();
	expect(result.container.querySelector('.ti-rocket-off') != null).toBe(expectedLocalOnly);
});
