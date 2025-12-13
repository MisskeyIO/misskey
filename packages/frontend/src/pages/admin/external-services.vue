<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<SearchMarker path="/admin/external-services" :label="i18n.ts.externalServices" :keywords="['external', 'services', 'thirdparty']" icon="ti ti-link">
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
					<MkButton primary @click="save_deepl">Save</MkButton>
				</div>
			</MkFolder>
		</FormSuspense>
	</div>
</PageWithHeader>
	</div>
	<template #footer>
		<div :class="$style.footer">
			<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 16px;">
				<MkButton primary rounded @click="save"><i class="ti ti-check"></i> {{ i18n.ts.save }}</MkButton>
			</div>
		</div>
	</template>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import MkInput from '@/components/MkInput.vue';
import MkButton from '@/components/MkButton.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkFolder from '@/components/MkFolder.vue';

const meta = await misskeyApi('admin/meta');

const deeplAuthKey = ref(meta.deeplAuthKey ?? '');
const deeplIsPro = ref(meta.deeplIsPro);
const googleAnalyticsMeasurementId = ref(meta.googleAnalyticsMeasurementId ?? '');

function save() {
	os.apiWithDialog('admin/update-meta', {
		deeplAuthKey: deeplAuthKey.value,
		deeplIsPro: deeplIsPro.value,
		googleAnalyticsId: googleAnalyticsId.value,
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

<style lang="scss" module>
.footer {
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
}
</style>
