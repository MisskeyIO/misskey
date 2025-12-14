import { defineAsyncComponent, ref } from 'vue';
import { miLocalStorage } from '@/local-storage.js';
import * as os from '@/os.js';

export type SensitiveContentConsentTrigger = 'media' | 'ad';

const SENSITIVE_CONTENT_CONSENT_KEY = 'sensitiveContentConsent';

function readSensitiveContentConsent(): boolean | null {
	const v = miLocalStorage.getItem(SENSITIVE_CONTENT_CONSENT_KEY);
	if (v === 'true') return true;
	if (v === 'false') return false;
	return null;
}

export const sensitiveContentConsent = ref<boolean | null>(readSensitiveContentConsent());

export function getSensitiveContentConsent(): boolean | null {
	return sensitiveContentConsent.value;
}

export function setSensitiveContentConsent(value: boolean): void {
	const v = value ? 'true' : 'false';
	miLocalStorage.setItem(SENSITIVE_CONTENT_CONSENT_KEY, v);
	sensitiveContentConsent.value = value;
}

export async function requestSensitiveContentConsent(trigger: SensitiveContentConsentTrigger): Promise<boolean> {
	const existing = getSensitiveContentConsent();
	if (existing !== null) return existing;

	return await new Promise<boolean>(async (resolve) => {
		const { dispose } = await os.popup(defineAsyncComponent(() => import('@/components/MkSensitiveContentConsent.vue')), {
			trigger,
		}, {
			decided: (allowed: boolean) => {
				dispose();
				sensitiveContentConsent.value = getSensitiveContentConsent();
				resolve(allowed);
			},
		});
	});
}
