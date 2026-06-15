/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { GtagConsentParams } from '@/types/gtag.js';

type GtagArguments = [command: string, target: string | Date, params?: Record<string, unknown> | GtagConsentParams];
type WindowWithGtag = Window & {
	dataLayer?: GtagArguments[];
	gtag?: (...args: GtagArguments) => void;
};

const gtagWindow: WindowWithGtag = window;

export function ensureGtag(): void {
	gtagWindow.dataLayer ??= [];
	gtagWindow.gtag ??= (...args: GtagArguments): void => {
		gtagWindow.dataLayer?.push(args);
	};
}

export function updateGtagConsent(params: GtagConsentParams): void {
	ensureGtag();
	gtagWindow.gtag?.('consent', 'update', params);
}

export function setGtag(params: Record<string, unknown>): void {
	ensureGtag();
	gtagWindow.gtag?.('set', 'user_properties', params);
}

export function setGtagConfig(params: Record<string, unknown>): void {
	ensureGtag();
	gtagWindow.gtag?.('set', 'config', params);
}
