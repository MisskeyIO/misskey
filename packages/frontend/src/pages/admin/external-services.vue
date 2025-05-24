<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<FormSuspense :p="init">
			<div class="_gaps_m">
				<MkFolder>
					<template #label>Google Analytics<span class="_beta">{{ i18n.ts.beta }}</span></template>

					<div class="_gaps_m">
						<MkInput v-model="googleAnalyticsMeasurementId">
							<template #prefix><i class="ti ti-key"></i></template>
							<template #label>Measurement ID</template>
						</MkInput>
						<MkButton primary @click="save_googleAnalytics">Save</MkButton>
					</div>
				</MkFolder>

				<MkFolder>
					<template #label>DeepL Translation</template>

				<div class="_gaps_m">
					<MkInput v-model="deeplAuthKey">
						<template #prefix><i class="ti ti-key"></i></template>
						<template #label>DeepL Auth Key</template>
					</MkInput>
					<MkSwitch v-model="deeplIsPro">
						<template #label>Pro account</template>
					</MkSwitch>
				</div>
			</MkFolder>
			<MkFolder>
				<template #label>Google Analytics</template>

				<div class="_gaps_m">
					<MkInput v-model="googleAnalyticsId">
						<template #prefix><i class="ti ti-report-analytics"></i></template>
						<template #label>Google Analytics ID</template>
					</MkInput>
					</div>
				</MkFolder>
			</div>
		</FormSuspense>
	</div>
	<template #footer>
		<div :class="$style.footer">
			<MkSpacer :contentMax="700" :marginMin="16" :marginMax="16">
				<MkButton primary rounded @click="save"><i class="ti ti-check"></i> {{ i18n.ts.save }}</MkButton>
			</MkSpacer>
		</div>
	</template>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import MkInput from '@/components/MkInput.vue';
import MkButton from '@/components/MkButton.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import FormSuspense from '@/components/form/suspense.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkFolder from '@/components/MkFolder.vue';

const deeplAuthKey = ref<string>('');
const deeplIsPro = ref<boolean>(false);
const googleAnalyticsId = ref<string>('');

const googleAnalyticsMeasurementId = ref<string>('');

// FIXME atode naosu

async function init() {
	const meta = await misskeyApi('admin/meta');
	deeplAuthKey.value = meta.deeplAuthKey ?? '';
	deeplIsPro.value = meta.deeplIsPro;
	googleAnalyticsMeasurementId.value = meta.googleAnalyticsMeasurementId ?? '';
	googleAnalyticsId.value = meta.googleAnalyticsId;
}

function save() {
	os.apiWithDialog('admin/update-meta', {
		deeplAuthKey: deeplAuthKey.value,
		deeplIsPro: deeplIsPro.value,
		googleAnalyticsId: googleAnalyticsId.value,
	}).then(() => {
		fetchInstance(true);
	});
}

function save_googleAnalytics() {
	os.apiWithDialog('admin/update-meta', {
		googleAnalyticsMeasurementId: googleAnalyticsMeasurementId.value,
	}).then(() => {
		fetchInstance(true);
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.externalServices,
	icon: 'ti ti-link',
}));
</script>
