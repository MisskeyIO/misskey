/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createGtag, screenview } from 'vue-gtag';
import type { Router } from '@/router.js';

export function createNiraxGtag(router: Pick<Router, 'addListener' | 'currentRoute'>, tagId: string, appName: string) {
	let initialized = false;
	const trackScreen = () => {
		const route = router.currentRoute.value;
		// 個別の投稿IDやクエリを含めず、画面の種類だけを記録する。
		screenview(route.name ?? route.path);
	};

	// NiraxはVue Router用の自動追跡に対応していない。
	router.addListener('change', ({ beforeFullPath, fullPath }) => {
		if (initialized && beforeFullPath.split(/[?#]/, 1)[0] !== fullPath.split(/[?#]/, 1)[0]) {
			trackScreen();
		}
	});

	return createGtag({
		tagId,
		config: {
			anonymize_ip: false,
			send_page_view: true,
		},
		initMode: 'manual',
		appName,
		hooks: {
			'config:init:after': () => {
				initialized = true;
				trackScreen();
			},
		},
	});
}
