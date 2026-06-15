<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkWindow ref="uiWindow" :initialWidth="400" :initialHeight="500" :canResize="true" @closed="emit('closed')">
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
			<MkSelect v-model="category" :items="categoryDef" required>
				<template #label>{{ i18n.ts.abuseReportCategory }}</template>
				<template v-if="categoryDescription" #caption>{{ categoryDescription }}</template>
			</MkSelect>

			<MkTextarea v-model="comment">
				<template #label>{{ i18n.ts.details }}</template>
				<template #caption>{{ i18n.ts.fillAbuseReportDescription }}</template>
			</MkTextarea>

			<MkButton primary full :disabled="comment.length === 0 || category == null" @click="send">{{ i18n.ts.send }}</MkButton>
		</div>
	</div>
</MkWindow>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import MkWindow from '@/components/MkWindow.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkButton from '@/components/MkButton.vue';
import MkSelect from '@/components/MkSelect.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	user: Misskey.entities.UserLite;
	initialComment?: string;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const uiWindow = useTemplateRef('uiWindow');
const comment = ref(props.initialComment ?? '');
type AbuseReportCategory = NonNullable<Misskey.entities.UsersReportAbuseRequest['category']>;

const category = ref<AbuseReportCategory | null>(null);
const categoryDef = [{
	label: i18n.ts.pleaseSelect,
	value: null,
}, {
	label: i18n.ts._abuseReportCategory.nsfw,
	value: 'nsfw' as const,
}, {
	label: i18n.ts._abuseReportCategory.spam,
	value: 'spam' as const,
}, {
	label: i18n.ts._abuseReportCategory.explicit,
	value: 'explicit' as const,
}, {
	label: i18n.ts._abuseReportCategory.phishing,
	value: 'phishing' as const,
}, {
	label: i18n.ts._abuseReportCategory.personalInfoLeak,
	value: 'personalInfoLeak' as const,
}, {
	label: i18n.ts._abuseReportCategory.selfHarm,
	value: 'selfHarm' as const,
}, {
	label: i18n.ts._abuseReportCategory.criticalBreach,
	value: 'criticalBreach' as const,
}, {
	label: i18n.ts._abuseReportCategory.otherBreach,
	value: 'otherBreach' as const,
}, {
	label: i18n.ts._abuseReportCategory.violationRights,
	value: 'violationRights' as const,
}, {
	label: i18n.ts._abuseReportCategory.violationRightsOther,
	value: 'violationRightsOther' as const,
}, {
	label: i18n.ts._abuseReportCategory.other,
	value: 'other' as const,
}] satisfies { label: string; value: AbuseReportCategory | null }[];

const categoryDescriptions = {
	nsfw: i18n.ts._abuseReportCategory.nsfw_description,
	spam: i18n.ts._abuseReportCategory.spam_description,
	explicit: i18n.ts._abuseReportCategory.explicit_description,
	phishing: i18n.ts._abuseReportCategory.phishing_description,
	personalInfoLeak: i18n.ts._abuseReportCategory.personalInfoLeak_description,
	selfHarm: i18n.ts._abuseReportCategory.selfHarm_description,
	criticalBreach: i18n.ts._abuseReportCategory.criticalBreach_description,
	otherBreach: i18n.ts._abuseReportCategory.otherBreach_description,
	violationRights: i18n.ts._abuseReportCategory.violationRights_description,
	violationRightsOther: i18n.ts._abuseReportCategory.violationRightsOther_description,
	other: '',
} satisfies Record<AbuseReportCategory, string>;

const categoryDescription = computed(() => category.value == null ? null : categoryDescriptions[category.value]);

function send() {
	if (category.value == null) return;

	os.apiWithDialog('users/report-abuse', {
		userId: props.user.id,
		comment: comment.value,
		category: category.value,
	}, undefined).then(res => {
		os.alert({
			type: 'success',
			text: i18n.ts.abuseReported,
		});
		uiWindow.value?.close();
		emit('closed');
	});
}
</script>

<style lang="scss" module>
.root {
	--root-margin: 16px;
}
</style>
