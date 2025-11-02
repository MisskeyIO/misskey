<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div v-if="token" class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps_m">
			<MkNewPassword ref="newPassword" :label="i18n.ts.newPassword"/>
			<MkButton primary :disabled="shouldDisableSubmitting" @click="save">{{ i18n.ts.save }}</MkButton>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, onMounted, ref, computed, shallowRef } from 'vue';
import MkNewPassword from '@/components/MkNewPassword.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { mainRouter } from '@/router.js';

const props = defineProps<{
	token?: string;
}>();

const newPassword = shallowRef<InstanceType<typeof MkNewPassword> | null>(null);
const submitting = ref<boolean>(false);

const shouldDisableSubmitting = computed((): boolean => {
	return submitting.value || !newPassword.value?.isValid;
});

async function save() {
	if (!newPassword.value?.isValid || submitting.value) return;
	submitting.value = true;

	await os.apiWithDialog('reset-password', {
		token: props.token,
		password: newPassword.value.password,
	});
	mainRouter.push('/');
}

onMounted(() => {
	if (props.token == null) {
		os.popup(defineAsyncComponent(() => import('@/components/MkForgotPassword.vue')), {}, {}, 'closed');
		mainRouter.push('/');
	}
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.resetPassword,
	icon: 'ti ti-lock',
}));
</script>
