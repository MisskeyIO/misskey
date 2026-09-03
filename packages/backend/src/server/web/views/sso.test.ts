/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import type { Config } from '@/config.js';
import type { CommonData } from '@/server/web/views/_.js';
import { SsoPage } from '@/server/web/views/sso.js';

const commonData = {
	version: 'test',
	config: {
		url: 'https://example.com',
		frontendManifestExists: true,
		frontendEntry: { file: 'entry.js', css: [] },
	} as unknown as Config,
	langs: ['ja-JP'],
	instanceName: 'Misskey',
	icon: null,
	appleTouchIcon: null,
	themeColor: null,
	serverErrorImageUrl: '/error.png',
	infoImageUrl: '/info.png',
	notFoundImageUrl: '/not-found.png',
	instanceUrl: 'https://example.com',
	now: 0,
	federationEnabled: true,
	frontendBootloaderJs: null,
	frontendBootloaderCss: null,
	frontendEmbedBootloaderJs: null,
	frontendEmbedBootloaderCss: null,
} satisfies CommonData;

describe('SsoPage', () => {
	test('認可情報をmeta要素へ埋め込む', () => {
		const html = SsoPage({
			...commonData,
			transactionId: 'transaction-id',
			serviceName: '\"><script>',
			kind: 'jwt',
			prompt: 'consent',
		});

		expect(html).toContain('name="misskey:sso:transaction-id" content="transaction-id"');
		expect(html).toContain('name="misskey:sso:service-name" content="&#34;><script>"');
		expect(html).not.toContain('content=""><script>');
		expect(html).toContain('name="misskey:sso:kind" content="jwt"');
		expect(html).toContain('name="misskey:sso:prompt" content="consent"');
	});
});
