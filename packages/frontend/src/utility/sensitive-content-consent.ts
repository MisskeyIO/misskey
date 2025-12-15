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

async function openSensitiveContentConsent(trigger: SensitiveContentConsentTrigger): Promise<boolean> {
	return await new Promise<boolean>(async (resolve) => {
		await os.popup(defineAsyncComponent(() => import('@/components/MkSensitiveContentConsent.vue')), {
			trigger,
		}, {
			decided: (allowed: boolean) => {
				sensitiveContentConsent.value = getSensitiveContentConsent();
				resolve(allowed);
			},
		}, 'closed');
	});
}

export async function requestSensitiveContentConsent(trigger: SensitiveContentConsentTrigger): Promise<boolean> {
	const existing = getSensitiveContentConsent();
	if (existing !== null) return existing;

	return await openSensitiveContentConsent(trigger);
}

export async function configureSensitiveContentConsent(trigger: SensitiveContentConsentTrigger = 'media'): Promise<boolean> {
	return await openSensitiveContentConsent(trigger);
}
