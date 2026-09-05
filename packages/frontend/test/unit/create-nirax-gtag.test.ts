/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createApp } from 'vue';
import { addGtag, configure, consent } from 'vue-gtag';
import { Nirax } from '@/lib/nirax.js';
import { createNiraxGtag } from '@/utility/create-nirax-gtag.js';

let dataLayer: IArguments[];

beforeEach(() => {
	dataLayer = [];
	vi.stubGlobal('dataLayer', dataLayer);
	configure({ tagId: 'G-TEST', initMode: 'manual', resource: { inject: false } });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function createRouter(path = '/') {
	const component = {};
	const router = new Nirax([
		{ path: '/', name: 'home', component },
		{ path: '/posts/:postId', component },
		{ path: '/settings', name: 'settings', component },
	], path, true, component);
	router.init();
	createApp({}).use(createNiraxGtag(router, 'G-TEST', 'Misskey test'));
	return router;
}

function screenViews() {
	return dataLayer.filter(([command, event]) => command === 'event' && event === 'screen_view')
		.map(([, , params]) => params);
}

test('同意済みの起動でもVue RouterのAPIを呼ばず画面を記録する', async () => {
	createRouter('/posts/private-id?token=secret#private');
	await addGtag();

	expect(screenViews()).toEqual([{ screen_name: '/posts/:postId', app_name: 'Misskey test' }]);
	expect(dataLayer.find(([command]) => command === 'config')?.[2]).toEqual({
		send_page_view: true,
		anonymize_ip: false,
	});
	expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
});

test.each(['granted', 'denied'] as const)('後からの同意を保持して初回と遷移を記録する（analytics_storage: %s）', async (analyticsStorage) => {
	const router = createRouter();
	consent('default', { analytics_storage: 'denied' });
	router.pushByPath('/posts/before-consent');
	expect(screenViews()).toEqual([]);
	expect(dataLayer.some(([command]) => command === 'config')).toBe(false);

	consent('update', { analytics_storage: analyticsStorage });
	await addGtag();
	router.pushByPath('/settings');

	expect(screenViews()).toEqual([
		{ screen_name: '/posts/:postId', app_name: 'Misskey test' },
		{ screen_name: 'settings', app_name: 'Misskey test' },
	]);
	expect(dataLayer.filter(([command]) => command === 'consent').map(args => Array.from(args))).toEqual([
		['consent', 'default', { analytics_storage: 'denied' }],
		['consent', 'update', { analytics_storage: analyticsStorage }],
	]);
});

test('同じパスのクエリやハッシュの変更を除き再初期化後も遷移を重複記録しない', async () => {
	const router = createRouter('/posts/first');
	await addGtag();
	router.pushByPath('/posts/first');
	router.pushByPath('/posts/first?token=secret');
	router.pushByPath('/posts/first?token=secret#private');
	expect(screenViews()).toHaveLength(1);

	await addGtag();
	expect(screenViews()).toHaveLength(2);
	router.pushByPath('/posts/second');
	expect(screenViews()).toEqual(Array.from({ length: 3 }, () => ({
		screen_name: '/posts/:postId',
		app_name: 'Misskey test',
	})));
	expect(router.listenerCount('change')).toBe(1);
});
