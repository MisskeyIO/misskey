<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithAnimBg>
	<div :class="$style.formContainer">
		<div :class="$style.form">
			<MkAuthConfirm
				ref="authRoot"
				:name="serviceName"
				:permissions="[]"
				:manualWaiting="manualWaiting"
				@accept="onAccept"
				@deny="onDeny"
			/>
		</div>
	</div>
</PageWithAnimBg>
</template>

<script lang="ts" setup>
import { onMounted, ref, useTemplateRef } from 'vue';
import { $i } from '@/i.js';
import { definePage } from '@/page.js';
import MkAuthConfirm from '@/components/MkAuthConfirm.vue';
import { generateClientTransactionId } from '@/utility/misskey-api.js';

type SsoKind = 'jwt' | 'saml';

type SsoAuthorizeResult = {
	binding: 'post';
	action: string;
	context: Record<string, string>;
} | {
	binding: 'redirect';
	action: string;
};

const transactionIdMeta = window.document.querySelector<HTMLMetaElement>('meta[name="misskey:sso:transaction-id"]');
if (transactionIdMeta) {
	transactionIdMeta.remove();
}

const serviceName = window.document.querySelector<HTMLMetaElement>('meta[name="misskey:sso:service-name"]')?.content;
const rawKind = window.document.querySelector<HTMLMetaElement>('meta[name="misskey:sso:kind"]')?.content;
const prompt = window.document.querySelector<HTMLMetaElement>('meta[name="misskey:sso:prompt"]')?.content;
const kind = narrowSsoKind(rawKind);
const transactionId = transactionIdMeta?.content ?? null;

const authRoot = useTemplateRef('authRoot');
const manualWaiting = ref($i != null && prompt === 'none');

function narrowSsoKind(value: string | undefined): SsoKind | null {
	return value === 'jwt' || value === 'saml' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
	return isRecord(value) && Object.values(value).every(v => typeof v === 'string');
}

function isSsoAuthorizeResult(value: unknown): value is SsoAuthorizeResult {
	if (!isRecord(value) || typeof value.action !== 'string') return false;

	if (value.binding === 'redirect') return true;
	if (value.binding === 'post') return isStringRecord(value.context);

	return false;
}

function showFailed() {
	manualWaiting.value = false;
	authRoot.value?.showUI('failed');
}

function submitPostBinding(result: Extract<SsoAuthorizeResult, { binding: 'post' }>) {
	const form = window.document.createElement('form');
	form.action = result.action;
	form.method = 'post';
	form.acceptCharset = 'utf-8';
	form.style.display = 'none';

	for (const [key, value] of Object.entries(result.context)) {
		const input = window.document.createElement('input');
		input.type = 'hidden';
		input.name = key;
		input.value = value;
		form.appendChild(input);
	}

	window.document.body.appendChild(form);
	form.submit();
}

function completeAuthorizeFlow(result: SsoAuthorizeResult) {
	if (result.binding === 'post') {
		submitPostBinding(result);
	} else {
		window.location.href = result.action;
	}
}

async function onAccept(loginToken: string) {
	if (kind == null || transactionId == null) {
		showFailed();
		return;
	}

	try {
		const response = await window.fetch(`/sso/${kind}/authorize`, {
			method: 'POST',
			credentials: 'include',
			cache: 'no-cache',
			headers: {
				'Content-Type': 'application/json',
				'X-Client-Transaction-Id': generateClientTransactionId('sso'),
			},
			body: JSON.stringify({
				transaction_id: transactionId,
				login_token: loginToken,
			}),
		});

		if (!response.ok) {
			showFailed();
			return;
		}

		const result: unknown = await response.json();
		if (!isSsoAuthorizeResult(result)) {
			showFailed();
			return;
		}

		completeAuthorizeFlow(result);
	} catch (err) {
		console.error(err);
		showFailed();
	}
}

function onDeny() {
	manualWaiting.value = false;
	authRoot.value?.showUI('denied');
}

onMounted(() => {
	if (kind == null || transactionId == null) {
		showFailed();
		return;
	}

	if ($i && prompt === 'none') {
		onAccept($i.token);
	}
});

definePage(() => ({
	title: 'Single Sign-On',
	icon: 'ti ti-login-2',
}));
</script>

<style lang="scss" module>
.formContainer {
	min-height: 100svh;
	padding: 32px 32px calc(env(safe-area-inset-bottom, 0px) + 32px) 32px;
	box-sizing: border-box;
	display: grid;
	place-content: center;
}

.form {
	position: relative;
	z-index: 10;
	border-radius: var(--MI-radius);
	background-color: var(--MI_THEME-panel);
	box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
	overflow: clip;
	max-width: 500px;
	width: calc(100vw - 64px);
	height: min(65svh, calc(100svh - calc(env(safe-area-inset-bottom, 0px) + 64px)));
	overflow-y: scroll;
}
</style>
