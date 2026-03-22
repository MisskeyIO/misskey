<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkWindow v-if="page === 1" ref="uiWindow" :initialWidth="500" :initialHeight="500" :canResize="true" @closed="emit('closed')">
	<template #header>
		<i class="ti ti-exclamation-circle" style="margin-right: 0.5em;"></i>
		<I18n :src="i18n.ts.reportAbuseOf" tag="span">
			<template #name>
				<b><MkAcct :user="user"/></b>
			</template>
		</I18n>
	</template>
	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 28px;">
		<div class="_gaps_m" :class="$style.root">
			<MkSelect v-model="category" :items="categoryItems" :required="true">
				<template #label>{{ i18n.ts.abuseReportCategory }}</template>
				<template v-if="category" #caption><Mfm :text="i18n.ts._abuseReportCategory[`${category}_description`]"/></template>
			</MkSelect>
			<MkTextarea v-model="comment">
				<template #label>{{ i18n.ts.details }}</template>
				<template #caption>{{ i18n.ts.fillAbuseReportDescription }}</template>
			</MkTextarea>
			<MkButton primary full :disabled="comment.length === 0 || category.length === 0" @click="send">{{ i18n.ts.send }}</MkButton>
		</div>
	</div>
</MkWindow>

<MkWindow v-if="page === 2" ref="uiWindow2" :initialWidth="450" :initialHeight="250" :canResize="true" @closed="emit('closed')">
	<template #header>
		<i class="ti ti-circle-check" style="margin-right: 0.5em;"></i>
		<span><MkAcct :user="props.user"/> {{ i18n.ts.reportComplete }}</span>
	</template>
	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 28px;">
		<div class="_gaps_m" :class="$style.root">
			<div>
				<p style="margin-bottom: 20px;">{{ i18n.ts.abuseReported }}</p>
				<MkButton :disabled="fullUserInfo?.isBlocking" @click="blockUser">{{ i18n.ts.blockThisUser }}</MkButton>
				<br>
				<MkButton :disabled="fullUserInfo?.isMuted" @click="muteUser">{{ i18n.ts.muteThisUser }}</MkButton>
			</div>
		</div>
	</div>
</MkWindow>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import type { Ref } from 'vue';
import * as Misskey from 'misskey-js';
import MkWindow from '@/components/MkWindow.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const props = defineProps<{
	user: Misskey.entities.UserLite;
	initialComment?: string;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

// FIXME 確認

const uiWindow = useTemplateRef<InstanceType<typeof MkWindow>>('uiWindow');
const uiWindow2 = useTemplateRef<InstanceType<typeof MkWindow>>('uiWindow2');
type AbuseReportCategory = 'nsfw' | 'spam' | 'explicit' | 'phishing' | 'personalInfoLeak' | 'selfHarm' | 'criticalBreach' | 'otherBreach' | 'violationRights' | 'violationRightsOther' | 'notLike' | 'other';

const comment = ref(props.initialComment ?? '');
const category = ref<'' | AbuseReportCategory>('');
const page = ref(1);
const fullUserInfo: Ref<Misskey.entities.UserDetailed | null> = ref(null);

const categoryItems: { label: string; value: '' | AbuseReportCategory }[] = [
	{ label: i18n.ts.selectCategory, value: '' },
	{ label: i18n.ts._abuseReportCategory.nsfw, value: 'nsfw' },
	{ label: i18n.ts._abuseReportCategory.spam, value: 'spam' },
	{ label: i18n.ts._abuseReportCategory.explicit, value: 'explicit' },
	{ label: i18n.ts._abuseReportCategory.phishing, value: 'phishing' },
	{ label: i18n.ts._abuseReportCategory.personalInfoLeak, value: 'personalInfoLeak' },
	{ label: i18n.ts._abuseReportCategory.selfHarm, value: 'selfHarm' },
	{ label: i18n.ts._abuseReportCategory.criticalBreach, value: 'criticalBreach' },
	{ label: i18n.ts._abuseReportCategory.otherBreach, value: 'otherBreach' },
	{ label: i18n.ts._abuseReportCategory.violationRights, value: 'violationRights' },
	{ label: i18n.ts._abuseReportCategory.violationRightsOther, value: 'violationRightsOther' },
	{ label: i18n.ts._abuseReportCategory.notLike, value: 'notLike' },
	{ label: i18n.ts._abuseReportCategory.other, value: 'other' },
];

function blockUser() {
	os.confirm({
		type: 'warning',
		title: i18n.ts.block,
		text: i18n.ts.blockConfirm,
	}).then((v) => {
		if (v.canceled) return;
		os.apiWithDialog('blocking/create', { userId: props.user.id }).then(refreshUserInfo);
	});
}

function muteUser() {
	os.apiWithDialog('mute/create', { userId: props.user.id }).then(refreshUserInfo);
}

function refreshUserInfo() {
	misskeyApi('users/show', { userId: props.user.id })
		.then((res) => {
			fullUserInfo.value = res;
		});
}

function send() {
	if (category.value === 'notLike') {
		uiWindow.value?.close();
		page.value = 2;
		return;
	}
	if (category.value === '') return;
	const reportCategory: Exclude<typeof category.value, ''> = category.value;
	os.apiWithDialog('users/report-abuse', {
		userId: props.user.id,
		comment: comment.value,
		category: reportCategory,
	}, undefined).then(res => {
		misskeyApi('users/show', { userId: props.user.id })
			.then((res) => {
				fullUserInfo.value = res;
				uiWindow.value?.close();
				page.value = 2;
			});
	});
}
</script>

<style lang="scss" module>
.root {
	--root-margin: 16px;
}
</style>
