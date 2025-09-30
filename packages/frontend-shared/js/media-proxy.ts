/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'misskey-js';
import {appendQuery, omitHttps, query} from './url.js';

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
			const url = (new URL(imageUrl)).searchParams.get('url');
			if (url) {
				_imageUrl = url;
			} else if (imageUrl.startsWith(this.serverMetadata.mediaProxy + '/')) {
				_imageUrl = imageUrl.slice(this.serverMetadata.mediaProxy.length + 1);
			} else if (imageUrl.startsWith('/proxy/')) {
				_imageUrl = imageUrl.slice('/proxy/'.length);
			} else if (imageUrl.startsWith(localProxy + '/')) {
				_imageUrl = imageUrl.slice(localProxy.length + 1);
			}
		}

		return appendQuery(
			`${mustOrigin ? localProxy : this.serverMetadata.mediaProxy}/${type === 'preview' ? 'preview' : 'image'}/${encodeURIComponent(omitHttps(_imageUrl))}`,
			query({
				...(!noFallback ? { 'fallback': '1' } : {}),
				...(type ? { [type]: '1' } : {}),
				...(mustOrigin ? { origin: '1' } : {}),
			}),
		);
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
