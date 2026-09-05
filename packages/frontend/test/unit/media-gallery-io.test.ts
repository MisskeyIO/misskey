/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue';
import type { entities } from 'misskey-js';
import type { Content } from '@/components/MkLightbox.item.vue';
import MkMediaList from '@/components/MkMediaList.vue';
import MkLightboxItem from '@/components/MkLightbox.item.vue';
import MkVideoControl from '@/components/MkVideoControl.vue';
import { DI } from '@/di.js';
import { sensitiveContentConsent, requestSensitiveContentConsent } from '@/utility/sensitive-content-consent.js';
import hasAudio from '@/utility/media-has-audio.js';
import * as os from '@/os.js';

const state = vi.hoisted(() => ({
	account: { id: 'me' } as { id: string } | null,
	preferences: {
		nsfw: 'respect',
		dataSaver: { media: false },
		confirmWhenRevealingSensitiveMedia: true,
	},
}));

vi.mock('@/i.js', () => ({ get $i() { return state.account; }, iAmModerator: false }));
vi.mock('@/preferences.js', () => ({ prefer: { s: state.preferences } }));
vi.mock('@/instance.js', () => ({ instance: {} }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin: vi.fn().mockResolvedValue(false) }));
vi.mock('@/utility/sensitive-content-consent.js', async () => {
	const { ref } = await import('vue');
	return { sensitiveContentConsent: ref<boolean | null>(null), requestSensitiveContentConsent: vi.fn() };
});
vi.mock('@/utility/media-has-audio.js', () => ({ default: vi.fn() }));
vi.mock('@/os.js', () => ({ confirm: vi.fn(), popupAsyncWithDialog: vi.fn() }));
vi.mock('@/components/MkLightbox.vue', () => ({ default: {} }));
vi.mock('@/components/MkMediaBanner.vue', () => ({ default: {} }));
vi.mock('@/components/MkImgWithBlurhash.vue', () => ({ default: {} }));
vi.mock('@/components/MkBlurhash.vue', () => ({ default: {} }));

const file = {
	id: 'sensitive-image',
	isSensitive: true,
	name: 'image.png',
	type: 'image/png',
	url: 'https://example.com/original.png',
	thumbnailUrl: 'https://example.com/thumbnail.png',
	properties: { width: 100, height: 100 },
} as entities.DriveFile;

const content: Content = {
	id: file.id,
	type: 'image',
	url: file.url,
	thumbnailUrl: file.thumbnailUrl,
	file,
};

const global = {
	stubs: { MkCondensedLine: true, MkLoading: true, MkBlurhash: true, MkMediaRange: true },
};

beforeEach(() => {
	vi.clearAllMocks();
	state.account = { id: 'me' };
	sensitiveContentConsent.value = null;
	vi.mocked(requestSensitiveContentConsent).mockImplementation(async () => {
		sensitiveContentConsent.value = true;
		return true;
	});
	vi.mocked(os.confirm).mockResolvedValue({ canceled: false });
	vi.mocked(os.popupAsyncWithDialog).mockResolvedValue({ dispose: vi.fn() } as Awaited<ReturnType<typeof os.popupAsyncWithDialog>>);
});

afterEach(cleanup);

function renderMediaList() {
	const list = ref<InstanceType<typeof MkMediaList>>();
	const result = render(defineComponent({
		setup: () => () => h(MkMediaList, { ref: list, mediaList: [file] }),
	}), { global });
	return { ...result, list };
}

test('個別確認をキャンセルした後もキーボード経路で画像を表示しない', async () => {
	vi.mocked(os.confirm).mockResolvedValue({ canceled: true });
	const result = renderMediaList();
	await fireEvent.click(result.getByText('Click to show'));
	await nextTick();
	expect(sensitiveContentConsent.value).toBe(true);
	expect(result.container.querySelector('img[src]')).toBeNull();
	await result.list.value?.openGallery();
	expect(os.confirm).toHaveBeenCalledTimes(2);
	expect(os.popupAsyncWithDialog).not.toHaveBeenCalled();
});

test('未ログインでは同意済みでもキーボードから画像を表示しない', async () => {
	state.account = null;
	sensitiveContentConsent.value = true;
	const result = renderMediaList();
	await result.list.value?.openGallery();
	expect(result.container.querySelector('img[src]')).toBeNull();
	expect(os.popupAsyncWithDialog).not.toHaveBeenCalled();
});

test('承認済みのサムネイルから開くときは確認を繰り返さない', async () => {
	const result = renderMediaList();
	await fireEvent.click(result.getByText('Click to show'));
	await waitFor(() => expect(result.container.querySelector('img')).not.toBeNull());
	await fireEvent.click(result.getByAltText(file.name));
	await nextTick();
	expect(os.confirm).toHaveBeenCalledOnce();
	expect(os.popupAsyncWithDialog).toHaveBeenCalledOnce();
	const props = vi.mocked(os.popupAsyncWithDialog).mock.calls[0][1] as { contents: Content[] };
	expect(props.contents[0].initiallyRevealed).toBe(true);
	const gallery = render(MkLightboxItem, { props: { content: props.contents[0], activated: true }, global });
	expect(gallery.container.querySelector(`img[src="${file.url}"]`)).not.toBeNull();
	expect(os.confirm).toHaveBeenCalledOnce();
});

test.each([false, true])('直接のプレビューも個別確認の結果を守る（キャンセル: %s）', async (canceled) => {
	sensitiveContentConsent.value = true;
	vi.mocked(os.confirm).mockResolvedValue({ canceled });
	const result = render(MkLightboxItem, { props: { content, activated: true }, global });
	expect(result.container.querySelector('img[src]')).toBeNull();
	await fireEvent.click(result.getByText('Click to show'));
	await waitFor(() => expect(os.confirm).toHaveBeenCalledOnce());
	await waitFor(() => expect(result.container.querySelector(`img[src="${file.url}"]`) != null).toBe(!canceled));
});

test.each([null, false])('承認済みの印があっても現在の同意状態 %s を優先する', (consent) => {
	sensitiveContentConsent.value = consent;
	const result = render(MkLightboxItem, { props: { content: { ...content, initiallyRevealed: true }, activated: true }, global });
	expect(result.container.querySelector('img[src]')).toBeNull();
});

test.each(['削除', '差し替え', '維持'])('音声判定後は対象動画が%sされた状態を反映する', async (operation) => {
	let complete!: (value: boolean) => void;
	const pending = new Promise<boolean>(resolve => { complete = resolve; });
	vi.mocked(hasAudio).mockReturnValueOnce(pending).mockReturnValue(new Promise(() => {}));
	const original = document.createElement('video');
	original.play = vi.fn().mockResolvedValue(undefined);
	const replacement = document.createElement('video');
	replacement.play = vi.fn().mockResolvedValue(undefined);
	const video = shallowRef<HTMLVideoElement | null>(original);
	render(MkVideoControl, { global: { ...global, provide: { [DI.mkLightboxItemVideoEl as symbol]: video } } });
	if (operation === '削除') video.value = null;
	if (operation === '差し替え') video.value = replacement;
	await nextTick();
	complete(false);
	await pending;
	await nextTick();
	expect(original.play).toHaveBeenCalledTimes(operation === '維持' ? 1 : 0);
	expect(replacement.play).not.toHaveBeenCalled();
	expect(replacement.muted).toBe(false);
});
