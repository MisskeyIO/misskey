import { set as gtagSet } from 'vue-gtag';
import type { GtagConsentParams } from '@/types/gtag.js';
import { generateClientTransactionId } from '@/utility/misskey-api.js';
import { miLocalStorage } from '@/local-storage.js';
import { instance } from '@/instance.js';

export type TrackingUserProperties = Record<string, string>;

export function getDeviceId(): string {
	return generateClientTransactionId('tracking-user').split('-')[0];
}

export function setUserProperties(properties: TrackingUserProperties): void {
	if (!instance.googleAnalyticsId && !instance.sentryForFrontend) return;

	const gtagConsent = miLocalStorage.getItemAsJson('gtagConsent') as GtagConsentParams | undefined;
	if (instance.googleAnalyticsId && gtagConsent?.ad_user_data === 'granted') {
		gtagSet({
			user_properties: properties,
		});
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
