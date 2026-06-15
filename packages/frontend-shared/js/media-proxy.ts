/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'misskey-js';
import { appendQuery, omitHttps, query } from './url.js';

function decodeProxyTarget(target: string): string {
	try {
		return decodeURIComponent(target);
	} catch (err) {
		console.warn(err);
		return target;
	}
}

function extractPathStyleProxyTarget(imageUrl: string, proxyBase: string): string | null {
	if (!imageUrl.startsWith(`${proxyBase}/`)) return null;

	const proxiedPath = imageUrl.slice(proxyBase.length + 1).split(/[?#]/, 1)[0];
	const target = proxiedPath.match(/^(?:preview|image|static)\/(.+)$/)?.[1];
	if (target == null) return null;

	return decodeProxyTarget(target);
}

function appendQueryIfNeeded(url: string, queryString: string): string {
	return queryString === '' ? url : appendQuery(url, queryString);
}

export class MediaProxy {
	private serverMetadata: Misskey.entities.MetaDetailed;
	private url: string;

	constructor(serverMetadata: Misskey.entities.MetaDetailed, url: string) {
		this.serverMetadata = serverMetadata;
		this.url = url;
	}

	public getProxiedImageUrl(imageUrl: string, type?: 'preview' | 'emoji' | 'avatar', mustOrigin = false, noFallback = false): string {
		const localProxy = `${this.url}/proxy`;
		let _imageUrl = imageUrl;

		if (imageUrl.startsWith(this.serverMetadata.mediaProxy + '/') || imageUrl.startsWith('/proxy/') || imageUrl.startsWith(localProxy + '/')) {
			// もう既にproxyっぽそうだったらurlを取り出す
			const url = imageUrl.startsWith('/proxy/') ? new URL(imageUrl, this.url) : new URL(imageUrl);
			const queryUrl = url.searchParams.get('url');
			const pathUrl = extractPathStyleProxyTarget(url.href, this.serverMetadata.mediaProxy)
				?? extractPathStyleProxyTarget(url.href, localProxy)
				?? extractPathStyleProxyTarget(url.pathname, '/proxy');
			_imageUrl = queryUrl ?? pathUrl ?? imageUrl;
		}

		return appendQueryIfNeeded(`${mustOrigin ? localProxy : this.serverMetadata.mediaProxy}/${
			type === 'preview' ? 'preview'
			: 'image'
		}/${encodeURIComponent(omitHttps(_imageUrl))}`, query({
			...(!noFallback ? { 'fallback': '1' } : {}),
			...(type ? { [type]: '1' } : {}),
			...(mustOrigin ? { origin: '1' } : {}),
		}));
	}

	public getProxiedImageUrlNullable(imageUrl: string | null | undefined, type?: 'preview'): string | null {
		if (imageUrl == null) return null;
		return this.getProxiedImageUrl(imageUrl, type);
	}

	public getStaticImageUrl(baseUrl: string): string {
		const u = baseUrl.startsWith('http') ? new URL(baseUrl) : new URL(baseUrl, this.url);

		if (u.href.startsWith(`${this.url}/emoji/`)) {
			// もう既にemojiっぽそうだったらsearchParams付けるだけ
			u.searchParams.set('static', '1');
			return u.href;
		}

		if (u.href.startsWith(this.serverMetadata.mediaProxy + '/')) {
			// もう既にproxyっぽそうだったらsearchParams付けるだけ
			u.searchParams.set('static', '1');
			return u.href;
		}

		return appendQuery(
			`${this.serverMetadata.mediaProxy}/static/${encodeURIComponent(omitHttps(u.href))}`,
			query({ static: '1' }),
		);
	}
}
