<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps_m">
	<MkInput ref="passwordInput" v-model="password" type="password" autocomplete="new-password" required :data-cy-signup-password="withSignupDataCy ? true : null">
		<template #label>{{ label ?? i18n.ts.newPassword }}</template>
		<template #prefix><i class="ti ti-lock"></i></template>
		<template #caption>
			<div class="_gaps_s">
				<div>
					<span v-if="password.length > 0 && password.length < minimumLength" :class="$style.error"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.tooShort }}</span>
					<span v-else-if="passwordStrength === 'low'" :class="$style.error"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.weakPassword }}</span>
					<span v-else-if="passwordStrength === 'medium'" :class="$style.warn"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.normalPassword }}</span>
					<span v-else-if="passwordStrength === 'high'" :class="$style.success"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.strongPassword }}</span>
				</div>

				<div v-if="leakCheckState === 'checking'" :class="$style.muted"><MkLoading :em="true"/> {{ i18n.ts.checking }}</div>
				<div v-else-if="leakCheckState === 'leaked'" :class="$style.error"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.leakedPassword }}</div>
				<div v-else-if="leakCheckState === 'error'" :class="$style.warn"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.error }}</div>
				<a :class="$style.link" href="https://haveibeenpwned.com/Passwords" target="_blank" rel="noopener noreferrer">Have I Been Pwned</a>
			</div>
		</template>
	</MkInput>

	<MkInput v-model="retypedPassword" type="password" autocomplete="new-password" required :data-cy-signup-password-retype="withSignupDataCy ? true : null">
		<template #label>{{ retypeLabel ?? i18n.ts.newPasswordRetype }}</template>
		<template #prefix><i class="ti ti-lock"></i></template>
		<template #caption>
			<span v-if="passwordRetypeState === 'match'" :class="$style.success"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.passwordMatched }}</span>
			<span v-else-if="passwordRetypeState === 'not-match'" :class="$style.error"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.passwordNotMatched }}</span>
		</template>
	</MkInput>
</div>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import MkInput from '@/components/MkInput.vue';
import { i18n } from '@/i18n.js';

type PasswordStrength = '' | 'low' | 'medium' | 'high';
type LeakCheckState = 'idle' | 'checking' | 'safe' | 'leaked' | 'error';

defineProps<{
	label?: string;
	retypeLabel?: string;
	withSignupDataCy?: boolean;
}>();

const minimumLength = 8;

const passwordInput = useTemplateRef('passwordInput');
const password = ref('');
const retypedPassword = ref('');
const leakCheckState = ref<LeakCheckState>('idle');
let leakAbortController: AbortController | null = null;
let leakCheckTimeoutId: number | null = null;
let leakCheckSequence = 0;

const passwordStrength = computed<PasswordStrength>(() => {
	if (password.value === '') return '';

	const strength = getPasswordStrength(password.value);
	return strength > 0.7 ? 'high' : strength > 0.3 ? 'medium' : 'low';
});

const passwordRetypeState = computed<null | 'match' | 'not-match'>(() => {
	if (retypedPassword.value === '') return null;
	return password.value === retypedPassword.value ? 'match' : 'not-match';
});

const isValid = computed(() => {
	return password.value.length >= minimumLength &&
		passwordRetypeState.value === 'match' &&
		leakCheckState.value !== 'checking' &&
		leakCheckState.value !== 'leaked';
});

function getPasswordStrength(source: string): number {
	let strength = 0;
	let power = 0.018;

	// 英数字
	if (/[a-zA-Z]/.test(source) && /[0-9]/.test(source)) {
		power += 0.020;
	}

	// 大文字と小文字が混ざってたら
	if (/[a-z]/.test(source) && /[A-Z]/.test(source)) {
		power += 0.015;
	}

	// 記号が混ざってたら
	if (/[!\x22\#$%&@'()*+,-./_]/.test(source)) {
		power += 0.02;
	}

	strength = power * source.length;

	return Math.max(0, Math.min(1, strength));
}

function abortLeakCheck(): void {
	if (leakAbortController != null) {
		leakAbortController.abort();
		leakAbortController = null;
	}

	if (leakCheckTimeoutId != null) {
		window.clearTimeout(leakCheckTimeoutId);
		leakCheckTimeoutId = null;
	}
}

async function sha1Hex(source: string): Promise<string> {
	const bytes = new TextEncoder().encode(source);
	const digest = await crypto.subtle.digest('SHA-1', bytes);
	return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function checkLeakedPassword(source: string, sequence: number): Promise<void> {
	abortLeakCheck();

	if (source.length < minimumLength) {
		leakCheckState.value = 'idle';
		return;
	}

	leakCheckState.value = 'checking';
	const controller = new AbortController();
	let timedOut = false;
	leakAbortController = controller;
	const timeoutId = window.setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, 10000);
	leakCheckTimeoutId = timeoutId;

	try {
		const hash = await sha1Hex(source);
		if (sequence !== leakCheckSequence) return;

		const prefix = hash.slice(0, 5);
		const suffix = hash.slice(5);
		const response = await window.fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(`HIBP range API returned ${response.status}`);
		}

		const body = await response.text();
		if (sequence !== leakCheckSequence) return;

		leakCheckState.value = body.split('\n').some(line => line.trim().split(':')[0] === suffix) ? 'leaked' : 'safe';
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError' && !timedOut) {
			return;
		}

		if (sequence === leakCheckSequence) {
			leakCheckState.value = 'error';
		}
	} finally {
		window.clearTimeout(timeoutId);
		if (leakCheckTimeoutId === timeoutId) {
			leakCheckTimeoutId = null;
		}

		if (leakAbortController === controller) {
			leakAbortController = null;
		}
	}
}

watch(password, value => {
	leakCheckSequence++;
	void checkLeakedPassword(value, leakCheckSequence);
});

onUnmounted(() => {
	leakCheckSequence++;
	abortLeakCheck();
});

defineExpose({
	isValid,
	password,
	focus: () => passwordInput.value?.focus(),
});
</script>

<style lang="scss" module>
.success {
	color: var(--MI_THEME-success);
}

.warn {
	color: var(--MI_THEME-warn);
}

.error {
	color: var(--MI_THEME-error);
}

.muted {
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);
}

.link {
	color: var(--MI_THEME-accent);
}
</style>
