<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps_s" :class="$style.root">
	<MkInput v-model="model.name" :readonly="!editable" required>
		<template #label>{{ i18n.ts.name }}</template>
	</MkInput>

	<MkInput v-model="model.targetUserPattern" :readonly="!editable" placeholder="^(LocalUser|RemoteUser@RemoteHost)$">
		<template #label>{{ i18n.ts._abuse._resolver.targetUserPattern }}</template>
	</MkInput>

	<MkInput v-model="model.reporterPattern" :readonly="!editable" placeholder="^(LocalUser|.*@RemoteHost)$">
		<template #label>{{ i18n.ts._abuse._resolver.reporterPattern }}</template>
	</MkInput>

	<MkInput v-model="model.reportContentPattern" :readonly="!editable" placeholder=".*">
		<template #label>{{ i18n.ts._abuse._resolver.reportContentPattern }}</template>
	</MkInput>

	<MkSelect v-model="model.expiresAt" :items="expiresAtDef" :disabled="!editable">
		<template #label>{{ i18n.ts._abuse._resolver.expiresAt }}</template>
		<template v-if="model.expirationDate" #caption><MkTime :time="model.expirationDate" mode="absolute"/></template>
	</MkSelect>

	<MkSwitch v-model="model.forward" :disabled="!editable">
		{{ i18n.ts._abuseUserReport.forward }}
		<template #caption>{{ i18n.ts._abuseUserReport.forwardDescription }}</template>
	</MkSwitch>

	<slot name="footer"></slot>
</div>
</template>

<script setup lang="ts">
import type * as Misskey from 'misskey-js';
import MkInput from '@/components/MkInput.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';

type ExpiresAt = Misskey.entities.AdminAbuseReportResolverCreateRequest['expiresAt'];

export type AbuseReportResolverEditorModel = {
	name: string;
	targetUserPattern: string;
	reporterPattern: string;
	reportContentPattern: string;
	expiresAt: ExpiresAt;
	forward: boolean;
	expirationDate: string | null;
};

defineProps<{
	editable: boolean;
}>();

const model = defineModel<AbuseReportResolverEditorModel>({ required: true });

const expiresAtDef = [{
	label: i18n.ts._abuse._resolver['1hour'],
	value: '1hour' as const,
}, {
	label: i18n.ts._abuse._resolver['12hours'],
	value: '12hours' as const,
}, {
	label: i18n.ts._abuse._resolver['1day'],
	value: '1day' as const,
}, {
	label: i18n.ts._abuse._resolver['1week'],
	value: '1week' as const,
}, {
	label: i18n.ts._abuse._resolver['1month'],
	value: '1month' as const,
}, {
	label: i18n.ts._abuse._resolver['3months'],
	value: '3months' as const,
}, {
	label: i18n.ts._abuse._resolver['6months'],
	value: '6months' as const,
}, {
	label: i18n.ts._abuse._resolver['1year'],
	value: '1year' as const,
}, {
	label: i18n.ts._abuse._resolver.indefinitely,
	value: 'indefinitely' as const,
}] satisfies { label: string; value: ExpiresAt }[];
</script>

<style module lang="scss">
.root {
	padding: var(--MI-margin);
}
</style>
