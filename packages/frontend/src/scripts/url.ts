/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* objを検査して
 * 1. 配列に何も入っていない時はクエリを付けない
 * 2. プロパティがundefinedの時はクエリを付けない
 * （new URLSearchParams(obj)ではそこまで丁寧なことをしてくれない）
 */
export function query(obj: Record<string, unknown>): string {
	const params = Object.entries(obj)
		.filter(([, v]) => Array.isArray(v) ? v.length : v !== undefined)
		.reduce((a, [k, v]) => (a[k] = v, a), {} as Record<string, any>);

	return Object.entries(params)
		.map((p) => `${p[0]}=${encodeURIComponent(p[1])}`)
		.join('&');
}

export function appendQuery(url: string, query: string): string {
	return `${url}${/\?/.test(url) ? url.endsWith('?') ? '' : '&' : '?'}${query}`;
}

export function omitHttps(url: string): string {
	if (url.startsWith('https://')) return url.slice(8);
	if (url.startsWith('https%3A%2F%2F')) return url.slice(14);
	return url;
}

export function maybeMakeRelative(urlStr: string, baseStr: string): string {
	try {
		const baseObj = new URL(baseStr);
		const urlObj = new URL(urlStr);
		/* in all places where maybeMakeRelative is used, baseStr is the
		 * instance's public URL, which can't have path components, so the
		 * relative URL will always have the whole path from the urlStr
		*/
		if (urlObj.origin === baseObj.origin) {
			return urlObj.pathname + urlObj.search + urlObj.hash;
		}
		return urlStr;
	} catch {
		return '';
	}
}
