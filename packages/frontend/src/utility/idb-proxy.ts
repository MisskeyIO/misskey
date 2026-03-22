/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// FirefoxのプライベートモードなどではindexedDBが使用不可能なので、
// indexedDBが使えない環境ではlocalStorageを使う
import {
	get as iget,
	set as iset,
	del as idel,
	clear as iclear,
	keys as ikeys,
} from 'idb-keyval';

const fallbackName = (key: string) => `idbfallback::${key}`;

let idbAvailable = typeof window !== 'undefined' ? !!(window.indexedDB && typeof window.indexedDB.open === 'function') : true;

// iframe.contentWindow.indexedDB.deleteDatabase() がchromeのバグで使用できないため、indexedDBを無効化している。
// バグが治って再度有効化するのであれば、cypressのコマンド内のコメントアウトを外すこと
// see https://github.com/misskey-dev/misskey/issues/13605#issuecomment-2053652123
if ('Cypress' in window && window.Cypress) {
	idbAvailable = false;
	console.log('Cypress detected. It will use localStorage.');
}

if (idbAvailable) {
	await iset('idb-test', 'test')
		.catch(err => {
			console.error('idb error', err);
			console.error('indexedDB is unavailable. It will use localStorage.');
			idbAvailable = false;
		});
} else {
	console.error('indexedDB is unavailable. It will use localStorage.');
}

export async function get(key: string) {
	if (idbAvailable) return iget(key);
	const value = window.localStorage.getItem(fallbackName(key));
	return value == null ? null : JSON.parse(value);
}

export async function set(key: string, val: any) {
	if (idbAvailable) return iset(key, val);
	return window.localStorage.setItem(fallbackName(key), JSON.stringify(val));
}

export async function del(key: string) {
	if (idbAvailable) return idel(key);
	return window.localStorage.removeItem(fallbackName(key));
}

export async function exist(key: string) {
	if (idbAvailable) {
		const keys = await ikeys();
		return keys.includes(key);
	}
	return window.localStorage.getItem(fallbackName(key)) !== null;
}

export async function clear() {
	if (idbAvailable) return iclear();
}
