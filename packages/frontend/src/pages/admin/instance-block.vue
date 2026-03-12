<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 600px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<MkSuspense :p="init">
			<MkTextarea v-if="tab === 'block'" v-model="blockedHosts">
				<span>{{ i18n.ts.blockedInstances }}</span>
				<template #caption>{{ i18n.ts.blockedInstancesDescription }}</template>
			</MkTextarea>
			<MkTextarea v-else-if="tab === 'silence'" v-model="silencedHosts" class="_formBlock">
				<span>{{ i18n.ts.silencedInstances }}</span>
				<template #caption>{{ i18n.ts.silencedInstancesDescription }}</template>
			</MkTextarea>
			<MkTextarea v-else-if="tab === 'sensitive'" v-model="sensitiveMediaHosts" class="_formBlock">
				<span>{{ i18n.ts.sensitiveMediaInstances }}</span>
				<template #caption>{{ i18n.ts.sensitiveMediaInstancesDescription }}</template>
			</MkTextarea>
			<MkButton primary @click="save"><i class="ti ti-device-floppy"></i> {{ i18n.ts.save }}</MkButton>
		</MkSuspense>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { definePage } from '@/page.js';
import MkButton from '@/components/MkButton.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';

const blockedHosts = ref<string>('');
const silencedHosts = ref<string>('');
const sensitiveMediaHosts = ref<string>('');
const tab = ref('block');

async function init() {
	const meta = await misskeyApi('admin/meta');
	blockedHosts.value = meta.blockedHosts.join('\n');
	silencedHosts.value = meta.silencedHosts.join('\n');
	sensitiveMediaHosts.value = meta.sensitiveMediaHosts.join('\n');
}

function save() {
	os.apiWithDialog('admin/update-meta', {
		blockedHosts: blockedHosts.value.split('\n') || [],
		silencedHosts: silencedHosts.value.split('\n') || [],
		sensitiveMediaHosts: sensitiveMediaHosts.value.split('\n') || [],

	}).then(() => {
		fetchInstance(true);
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'block',
	title: i18n.ts.block,
	icon: 'ti ti-ban',
}, {
	key: 'silence',
	title: i18n.ts.silence,
	icon: 'ti ti-eye-off',
}, {
	key: 'sensitive',
	title: i18n.ts.sensitive,
	icon: 'ti ti-photo-exclamation',
}]);

definePage(() => ({
	title: i18n.ts.instanceBlocking,
	icon: 'ti ti-ban',
}));
</script>
