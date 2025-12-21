import { defineAsyncComponent, ref } from 'vue';
import { miLocalStorage } from '@/local-storage.js';
import * as os from '@/os.js';

const SENSITIVE_CONTENT_CONSENT_KEY = 'sensitiveContentConsent';

function readSensitiveContentConsent(): boolean | null {
	const v = miLocalStorage.getItem(SENSITIVE_CONTENT_CONSENT_KEY);
	if (v === 'true') return true;
	if (v === 'false') return false;
	return null;
}

export const sensitiveContentConsent = ref<boolean | null>(readSensitiveContentConsent());

export function setSensitiveContentConsent(value: boolean): void {
	const v = value ? 'true' : 'false';
	miLocalStorage.setItem(SENSITIVE_CONTENT_CONSENT_KEY, v);
	sensitiveContentConsent.value = value;
}

async function openSensitiveContentConsent(): Promise<boolean> {
	return await new Promise<boolean>(async (resolve) => {
		await os.popup(defineAsyncComponent(() => import('@/components/MkSensitiveContentConsent.vue')), {}, {
			decided: (allowed: boolean) => {
				resolve(allowed);
			},
		}, 'closed');
	});
}

export async function requestSensitiveContentConsent(): Promise<boolean> {
	if (sensitiveContentConsent.value !== null) return sensitiveContentConsent.value;

	return await openSensitiveContentConsent();
}

export async function configureSensitiveContentConsent(): Promise<boolean> {
	return await openSensitiveContentConsent();
}
