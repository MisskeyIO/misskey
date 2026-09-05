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

	try {
		miLocalStorage.removeItem('instance');
		miLocalStorage.removeItem('instanceCachedAt');
		miLocalStorage.removeItem('emojis');
		miLocalStorage.removeItem('lastEmojisFetchedAt');
		clearAppliedThemeCache();
		// ログイン情報や下書きと同じ保存領域なので、対象のキーだけを削除する。
		await Promise.all([del('emojis'), del('lastEmojisFetchedAt')]);
		await misskeyApiGet('clear-browser-cache');
		const refreshed = await Promise.allSettled([
			fetchInstance(true),
			fetchCustomEmojis(true),
		]);
		// 片方が失敗しても、残りの保存と次の試行を競合させない。
		const failed = refreshed.find(result => result.status === 'rejected');
		if (failed) throw failed.reason;
	} catch {
		return os.alert({ type: 'error', title: i18n.ts.clearCache, text: `${i18n.ts.somethingHappened}\n${i18n.ts.tryAgain}` });
	} finally {
		done();
	}

	unisonReload();
}
