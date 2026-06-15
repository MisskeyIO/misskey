/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { GtagConsentParams } from '@/types/gtag.js';
import { generateClientTransactionId } from '@/utility/misskey-api.js';
import { miLocalStorage } from '@/local-storage.js';
import { instance } from '@/instance.js';
import { setGtag } from '@/utility/gtag.js';

export type TrackingUserProperties = Record<string, string>;

export function getDeviceId(): string {
	const stored = miLocalStorage.getItem('id');
	if (stored != null) return stored;

	const generated = generateClientTransactionId('tracking-user').split('-')[0];
	miLocalStorage.setItem('id', generated);
	return generated;
}

export function setUserProperties(properties: TrackingUserProperties): void {
	if (!instance.googleAnalyticsMeasurementId && !instance.sentryForFrontend) return;

	const gtagConsent = miLocalStorage.getItemAsJson('gtagConsent') as GtagConsentParams | undefined;
	if (instance.googleAnalyticsMeasurementId && gtagConsent?.ad_user_data === 'granted') {
		setGtag(properties);
	}

	if (instance.sentryForFrontend) {
		void import('@sentry/vue')
			.then(Sentry => {
				Sentry.setUser({
					...properties,
				});
			})
			.catch(() => {
				// ignore
			});
	}
}
