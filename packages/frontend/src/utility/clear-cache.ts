/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { unisonReload } from '@/utility/unison-reload.js';
import { misskeyApiGet } from '@/utility/misskey-api.js';
import * as os from '@/os.js';
import { miLocalStorage } from '@/local-storage.js';
import { fetchCustomEmojis } from '@/custom-emojis.js';
import { fetchInstance } from '@/instance.js';
import { clearAppliedThemeCache } from '@/theme.js';
import { del } from '@/utility/idb-proxy.js';
import { i18n } from '@/i18n.js';

export async function clearCache() {
	const done = os.waiting();
	const controller = new AbortController();
	let timeout: number | undefined;
	const deadline = new Promise<never>((_, reject) => {
		timeout = window.setTimeout(() => {
			controller.abort();
			reject(new Error('キャッシュ削除が時間内に完了しませんでした'));
		}, 10_000);
	});

	try {
		await Promise.race([
			(async () => {
				miLocalStorage.removeItem('instance');
				miLocalStorage.removeItem('instanceCachedAt');
				miLocalStorage.removeItem('emojis');
				miLocalStorage.removeItem('lastEmojisFetchedAt');
				clearAppliedThemeCache();
				// ログイン情報や下書きと同じ保存領域なので、対象のキーだけを削除する。
				await Promise.all([del('emojis'), del('lastEmojisFetchedAt')]);
				controller.signal.throwIfAborted();
				await misskeyApiGet('clear-browser-cache', {}, 'misskey', controller.signal);
				controller.signal.throwIfAborted();
				await Promise.all([
					fetchInstance(true, controller.signal),
					fetchCustomEmojis(true, controller.signal),
				]);
			})(),
			deadline,
		]);
	} catch {
		return os.alert({ type: 'error', title: i18n.ts.clearCache, text: `${i18n.ts.somethingHappened}\n${i18n.ts.tryAgain}` });
	} finally {
		window.clearTimeout(timeout);
		controller.abort();
		done();
	}

	unisonReload();
}
