/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { apiUrl, host } from '@@/js/config.js';
import { cloudBackup } from '@/preferences/utility.js';
import { store } from '@/store.js';
import { waiting } from '@/os.js';
import { unisonReload } from '@/utility/unison-reload.js';
import { $i } from '@/i.js';
import { generateClientTransactionId } from '@/utility/misskey-api.js';
import { miLocalStorage } from '@/local-storage.js';
import { getAccounts, login, removeAccount } from '@/accounts.js';

export async function signout() {
	if (!$i) return;

	waiting();

	if (store.s.enablePreferencesAutoCloudBackup) {
		await cloudBackup();
	}

	document.cookie.split(';').forEach((cookie) => {
		const cookieName = cookie.split('=')[0].trim();
		if (cookieName === 'token') {
			document.cookie = `${cookieName}=; max-age=0; path=/`;
		}
	});

	miLocalStorage.removeItem('account');
	await removeAccount(host, $i.id);
	const accounts = await getAccounts();
	const nextAccount = accounts.find(account => account.token != null);

	//#region Remove service worker registration
	try {
		if (navigator.serviceWorker.controller) {
			const registration = await navigator.serviceWorker.ready;
			const push = await registration.pushManager.getSubscription();
			if (push) {
				await window.fetch(`${apiUrl}/sw/unregister`, {
					method: 'POST',
					body: JSON.stringify({
						i: $i.token,
						endpoint: push.endpoint,
					}),
					credentials: 'include',
					headers: {
						'Content-Type': 'application/json',
						'X-Client-Transaction-Id': generateClientTransactionId('service-worker'),
					},
				});
			}
		}

		if (!nextAccount) {
			await navigator.serviceWorker.getRegistrations()
				.then(registrations => {
					return Promise.all(registrations.map(registration => registration.unregister()));
				});
		}
	} catch {
		// nothing
	}
	//#endregion

	if (nextAccount?.token) {
		await login(nextAccount.token);
	} else {
		unisonReload('/');
	}
}
