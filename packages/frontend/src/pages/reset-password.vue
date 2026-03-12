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
import { onMounted, ref, computed, shallowRef } from 'vue';
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
	if (props.token == null || submitting.value) return;

	const password = newPassword.value?.password;
	if (!password) return;

	submitting.value = true;
	try {
		await os.apiWithDialog('reset-password', {
			token: props.token,
			password,
		});
		mainRouter.push('/');
	} finally {
		submitting.value = false;
	}
}

onMounted(async () => {
	if (props.token == null) {
		const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkForgotPassword.vue').then(x => x.default), {}, {
			closed: () => dispose(),
		});

		await os.popupAsyncWithDialog(import('@/components/MkForgotPassword.vue').then(x => x.default), {}, {
			initialPage: 1,
		}, 'closed');

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
