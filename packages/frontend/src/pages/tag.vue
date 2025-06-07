<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 800px;">
			<div v-if="tab === 'all'">
				<MkNotes ref="notes" class="" :pagination="pagination"/>
			</div>
			<div v-else-if="tab === 'localOnly'">
				<MkNotes ref="notes" class="" :pagination="localOnlyPagination"/>
			</div>
			<div v-else-if="tab === 'withFiles'">
				<MkNotes ref="notes" class="" :pagination="withFilesPagination"/>
			</div>
	</div>
	<template v-if="$i" #footer>
		<div :class="$style.footer">
			<div class="_spacer" style="--MI_SPACER-w: 800px; --MI_SPACER-min: 16px; --MI_SPACER-max: 16px;">
				<MkButton rounded primary :class="$style.button" @click="post()"><i class="ti ti-pencil"></i>{{ i18n.ts.postToHashtag }}</MkButton>
			</div>
		</div>
	</template>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import MkNotes from '@/components/MkNotes.vue';
import MkButton from '@/components/MkButton.vue';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { store } from '@/store.js';
import * as os from '@/os.js';

const tab = ref('all');

const props = defineProps<{
	tag: string;
}>();

const pagination = {
	endpoint: 'notes/search-by-tag' as const,
	limit: 10,
	params: computed(() => ({
		tag: props.tag,
	})),
};
const notes = ref<InstanceType<typeof MkNotes>>();

const localOnlyPagination = {
	endpoint: 'notes/search-by-tag' as const,
	limit: 10,
	params: computed(() => ({
		tag: props.tag,
		local: true,
	})),
};

const withFilesPagination = {
	endpoint: 'notes/search-by-tag' as const,
	limit: 10,
	params: computed(() => ({
		tag: props.tag,
		withFiles: true,
	})),
};

async function post() {
	store.set('postFormHashtags', props.tag);
	store.set('postFormWithHashtags', true);
	await os.post();
	store.set('postFormHashtags', '');
	store.set('postFormWithHashtags', false);
	notes.value?.pagingComponent?.reload();
}

const headerActions = [];

// computed(() => [
// 	{
// 	icon: 'ti ti-dots',
// 	label: i18n.ts.more,
// 	handler: (ev: MouseEvent) => {
// 		os.popupMenu([{
// 			text: i18n.ts.embed,
// 			icon: 'ti ti-code',
// 			action: () => {
// 				genEmbedCode('tags', props.tag);
// 			},
// 		}], ev.currentTarget ?? ev.target);
// 	},
// }
// 	]);

const headerTabs = computed(() => [{
	key: 'all',
	title: i18n.ts.all,
}, {
	key: 'localOnly',
	title: i18n.ts.localOnly,
}, {
	key: 'withFiles',
	title: i18n.ts.withFiles,
}]);

definePage(() => ({
	title: props.tag,
	icon: 'ti ti-hash',
}));
</script>

<style lang="scss" module>
.footer {
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
	background: color(from var(--MI_THEME-bg) srgb r g b / 0.5);
	border-top: solid 0.5px var(--MI_THEME-divider);
	display: flex;
}

.button {
	margin: 0 auto;
}
</style>
