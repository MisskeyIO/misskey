/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { url as local } from '@@/js/config.js';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';

function getHost(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

function isLocalUrl(url: string): boolean {
	try {
		return new URL(url).origin === new URL(local).origin;
	} catch {
		return false;
	}
}

function matchesWebsiteExpression(url: string, host: string, expression: string): boolean {
	const normalizedExpression = expression.trim().toLowerCase();
	if (normalizedExpression === '') return false;

	const regexp = /^\/(.+)\/([dgimsuy]*)$/.exec(normalizedExpression);
	if (regexp) {
		try {
			return new RegExp(regexp[1], regexp[2]).test(url);
		} catch {
			return false;
		}
	}

	if (normalizedExpression.includes(' ')) {
		const normalizedUrl = url.toLowerCase();
		return normalizedExpression.split(' ').every(keyword => normalizedUrl.includes(keyword));
	}

	return `.${host}`.endsWith(`.${normalizedExpression}`);
}

export async function warningExternalWebsite(ev: MouseEvent, url: string): Promise<boolean> {
	const host = getHost(url);
	if (host == null || isLocalUrl(url)) return true;

	ev.preventDefault();
	ev.stopPropagation();

	const isWellKnownWebsite = (instance.wellKnownWebsites ?? []).some(expression => matchesWebsiteExpression(url, host, expression));
	const isTrusted = prefer.r.trustedExternalWebsites.value.includes(host);
	if (!isWellKnownWebsite && !isTrusted) {
		const confirm = await os.confirm({
			type: 'warning',
			title: i18n.ts.warningRedirectingExternalWebsiteTitle,
			text: i18n.tsx.warningRedirectingExternalWebsiteDescription({ url }),
		});

		if (confirm.canceled) return false;
	}

	window.open(url, '_blank', 'noopener');
	return true;
}
