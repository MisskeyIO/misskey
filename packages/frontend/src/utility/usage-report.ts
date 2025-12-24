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

const USAGE_REPORT_BUFFER_MS = 1000;
const usageReportBuffer: UsageReport[] = [];
let usageReportBufferTimer: number | null = null;

export function usageReport(data: UsageReport) {
	if (disableUsageReport) return;

	usageReportBuffer.push(data);
	if (usageReportBufferTimer === null) {
		usageReportBufferTimer = window.setTimeout(() => {
			sendUsageReport();
		}, USAGE_REPORT_BUFFER_MS);
	}
}

export function sendUsageReport() {
	if (usageReportBuffer.length === 0) return;
	const payload = usageReportBuffer.splice(0, usageReportBuffer.length);
	usageReportBufferTimer = null;

	const gtagConsent = miLocalStorage.getItemAsJson('gtagConsent') as GtagConsentParams | undefined;
	if (!gtagConsent || gtagConsent.ad_user_data !== 'granted') {
		console.log('Usage report is not sent because the user has not consented to sharing data about ad interactions.');
		disableUsageReport = true;
		return;
	}

	const fallback = () => {
		window.fetch('/api/usage', {
			method: 'POST',
			body: JSON.stringify(payload),
			cache: 'no-cache',
			credentials: 'include',
			keepalive: true,
			headers: {
				'Content-Type': 'application/json',
				'X-Client-Transaction-Id': generateClientTransactionId('misskey'),
			},
		});
	};

	if ('serviceWorker' in navigator) {
		if (navigator.serviceWorker.controller) {
			navigator.serviceWorker.controller.postMessage({
				type: 'usage-report',
				payload,
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
					payload,
				});
			})
			.catch(() => {
				fallback();
			});
		return;
	}

	fallback();
}
