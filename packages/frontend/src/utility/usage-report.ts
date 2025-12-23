/* eslint-disable id-denylist */
// send usage report data to the server
// POST /api/usage [ { t: number, e: string, i: string, a: string } ]
// t: timestamp
// e: event type
// i: event initiator
// a: action

import type { GtagConsentParams } from '@/types/gtag.js';
import { generateClientTransactionId } from '@/utility/misskey-api.js';
import { miLocalStorage } from '@/local-storage.js';
import { instance } from '@/instance.js';

export interface UsageReport {
	t: number;
	e: string;
	i: string;
	a: string;
}

let disableUsageReport = !instance.googleAnalyticsId;

export function usageReport(data: UsageReport) {
	if (disableUsageReport) return;

	sendUsageReport(data);
}

export function sendUsageReport(data: UsageReport) {
	const gtagConsent = miLocalStorage.getItemAsJson('gtagConsent') as GtagConsentParams | null;
	if (!gtagConsent || gtagConsent.ad_user_data !== 'granted') {
		console.log('Usage report is not sent because the user has not consented to sharing data about ad interactions.');
		disableUsageReport = true;
		return;
	}

	const payload = [data];
	const requestInit: RequestInit = {
		method: 'POST',
		body: JSON.stringify(payload),
		cache: 'no-cache',
		credentials: 'include' as const,
		headers: {
			'Content-Type': 'application/json',
			'X-Client-Transaction-Id': generateClientTransactionId('misskey'),
		},
	};

	const fallback = () => {
		window.fetch('/api/usage', {
			...requestInit,
			keepalive: true,
		});
	};

	if ('serviceWorker' in navigator) {
		if (navigator.serviceWorker.controller) {
			navigator.serviceWorker.controller.postMessage({
				type: 'usage-report',
				request: requestInit,
			});
			return;
		}

		navigator.serviceWorker.ready
			.then(registration => {
				if (!registration.active) {
					fallback();
					return;
				}

				registration.active.postMessage({
					type: 'usage-report',
					request: requestInit,
				});
			})
			.catch(() => {
				fallback();
			});
		return;
	}

	fallback();
}
