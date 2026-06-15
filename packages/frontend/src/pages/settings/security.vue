<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/security" :label="i18n.ts.security" :keywords="['security']" icon="ti ti-lock" :inlining="['2fa']">
	<MkModalWindow
		v-if="isChangePasswordDialogOpen"
		ref="changePasswordDialog"
		:width="450"
		@close="closeChangePasswordDialog"
		@closed="isChangePasswordDialogOpen = false"
	>
		<template #header>{{ i18n.ts.changePassword }}</template>

		<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 32px;">
			<form class="_gaps_m" @submit.prevent="submitNewPassword">
				<MkNewPassword ref="newPassword"/>
				<MkButton type="submit" primary rounded :disabled="newPassword?.isValid !== true || changingPassword" style="margin: 0 auto;">
					<MkLoading v-if="changingPassword" :em="true" :colored="false"/>
					<template v-else>{{ i18n.ts.save }}</template>
				</MkButton>
			</form>
		</div>
	</MkModalWindow>

	<div class="_gaps_m">
		<MkFeatureBanner icon="/client-assets/locked_with_key_3d.png" color="#ffbf00">
			<SearchText>{{ i18n.ts._settings.securityBanner }}</SearchText>
		</MkFeatureBanner>

		<SearchMarker :keywords="['password']">
			<FormSection first>
				<template #label><SearchLabel>{{ i18n.ts.password }}</SearchLabel></template>

				<SearchMarker>
					<MkButton primary @click="change()">
						<SearchLabel>{{ i18n.ts.changePassword }}</SearchLabel>
					</MkButton>
				</SearchMarker>
			</FormSection>
		</SearchMarker>

		<X2fa/>

		<SearchMarker :keywords="['signin', 'login', 'history', 'log']">
			<FormSection>
				<template #label><SearchLabel>{{ i18n.ts.signinHistory }}</SearchLabel></template>
				<MkPagination :paginator="paginator" withControl :forceDisableInfiniteScroll="true">
					<template #default="{items}">
						<div>
							<div v-for="item in items" :key="item.id" v-panel class="timnmucd">
								<header>
									<i v-if="item.success" class="ti ti-check icon succ"></i>
									<i v-else class="ti ti-circle-x icon fail"></i>
									<code class="ip _monospace">{{ item.ip }}</code>
									<MkTime :time="item.createdAt" class="time"/>
								</header>
							</div>
						</div>
					</template>
				</MkPagination>
			</FormSection>
		</SearchMarker>

		<SearchMarker :keywords="['regenerate', 'refresh', 'reset', 'token']">
			<FormSection>
				<FormSlot>
					<MkButton danger @click="regenerateToken"><i class="ti ti-refresh"></i> <SearchLabel>{{ i18n.ts.regenerateLoginToken }}</SearchLabel></MkButton>
					<template #caption>{{ i18n.ts.regenerateLoginTokenDescription }}</template>
				</FormSlot>
			</FormSection>
		</SearchMarker>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { computed, markRaw, ref } from 'vue';
import X2fa from './2fa.vue';
import FormSection from '@/components/form/section.vue';
import FormSlot from '@/components/form/slot.vue';
import MkButton from '@/components/MkButton.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkNewPassword from '@/components/MkNewPassword.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkFeatureBanner from '@/components/MkFeatureBanner.vue';
import { Paginator } from '@/utility/paginator.js';

const paginator = markRaw(new Paginator('i/signin-history', {
	limit: 5,
}));

const isChangePasswordDialogOpen = ref(false);
const changingPassword = ref(false);
const changePasswordDialog = ref<InstanceType<typeof MkModalWindow> | null>(null);
const newPassword = ref<InstanceType<typeof MkNewPassword> | null>(null);

async function change() {
	isChangePasswordDialogOpen.value = true;
}

function closeChangePasswordDialog() {
	if (changingPassword.value) return;
	changePasswordDialog.value?.close();
}

async function submitNewPassword() {
	if (changingPassword.value) return;
	if (newPassword.value?.isValid !== true) return;

	const auth = await os.authenticateDialog();
	if (auth.canceled) return;

	changingPassword.value = true;
	try {
		await os.apiWithDialog('i/change-password', {
			currentPassword: auth.result.password,
			token: auth.result.token,
			newPassword: newPassword.value.password,
		});
		changePasswordDialog.value?.close();
	} finally {
		changingPassword.value = false;
	}
}

async function regenerateToken() {
	const auth = await os.authenticateDialog();
	if (auth.canceled) return;

	misskeyApi('i/regenerate-token', {
		password: auth.result.password,
		token: auth.result.token,
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.security,
	icon: 'ti ti-lock',
}));
</script>

<style lang="scss" scoped>
.timnmucd {
	padding: 12px;

	&:first-child {
		border-top-left-radius: 6px;
		border-top-right-radius: 6px;
	}

	&:last-child {
		border-bottom-left-radius: 6px;
		border-bottom-right-radius: 6px;
	}

	&:not(:last-child) {
		border-bottom: solid 0.5px var(--MI_THEME-divider);
	}

	> header {
		display: flex;
		align-items: center;

		> .icon {
			width: 1em;
			margin-right: 0.75em;

			&.succ {
				color: var(--MI_THEME-success);
			}

			&.fail {
				color: var(--MI_THEME-error);
			}
		}

		> .ip {
			flex: 1;
			min-width: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			margin-right: 12px;
		}

		> .time {
			margin-left: auto;
			opacity: 0.7;
		}
	}
}
</style>
