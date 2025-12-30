<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :tabs="headerTabs" :actions="headerActions">
	<div v-if="error != null" class="_spacer" style="--MI_SPACER-w: 1200px;">
		<div :class="$style.root">
			<img :class="$style.img" :src="serverErrorImageUrl" draggable="false"/>
			<p :class="$style.text">
				<i class="ti ti-alert-triangle"></i>
				{{ error }}
			</p>
		</div>
	</div>
	<div v-else-if="tab === 'users'" class="_spacer" style="--MI_SPACER-w: 1200px;">
		<div class="_gaps_s">
			<div v-if="role">{{ role.description }}</div>
			<MkUserList v-if="visible" :pagination="users" :extractor="(item) => item.user"/>
			<div v-else-if="!visible" class="_fullinfo">
				<img :src="infoImageUrl" draggable="false"/>
				<div>{{ i18n.ts.nothing }}</div>
			</div>
		</div>
	</div>
	<div v-else-if="tab === 'timeline'" class="_spacer" style="--MI_SPACER-w: 700px;">
		<MkTimeline
			v-if="visible"
			ref="timeline"
			:key="`${props.roleId}:${dimension}`"
			src="role"
			:role="props.roleId"
			:dimension="dimension"
		/>
		<div v-else-if="!visible" class="_fullinfo">
			<img :src="infoImageUrl" draggable="false"/>
			<div>{{ i18n.ts.nothing }}</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, watch, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { instanceName } from '@@/js/config.js';
import type { PageHeaderItem } from '@/types/page-header.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import MkUserList from '@/components/MkUserList.vue';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import MkTimeline from '@/components/MkTimeline.vue';
import { serverErrorImageUrl, infoImageUrl } from '@/instance.js';
import { $i } from '@/i.js';
import { store } from '@/store.js';
import { deepMerge } from '@/utility/merge.js';
import { selectDimension } from '@/utility/dimension.js';
import { claimAchievement } from '@/utility/achievements.js';
import { prefer } from '@/preferences.js';

const props = withDefaults(defineProps<{
	roleId: string;
	initialTab?: string;
}>(), {
	initialTab: 'users',
});

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const tab = ref(props.initialTab);
const role = ref<Misskey.entities.Role | null>(null);
const error = ref<string | null>(null);
const visible = ref(false);
const dimensionKey = computed(() => `role:${props.roleId}`);
const dimension = computed<number>({
	get: () => store.r.tl.value?.dimensionBySrc?.[dimensionKey.value] ?? prefer.s.dimension,
	set: (value) => saveTlDimension(value),
});

watch(() => props.roleId, () => {
	misskeyApi('roles/show', {
		roleId: props.roleId,
	}).then(res => {
		role.value = res;
		error.value = null;
		visible.value = res.isExplorable && res.isPublic;
	}).catch((err) => {
		if (err.code === 'NO_SUCH_ROLE') {
			error.value = i18n.ts.noRole;
		} else {
			error.value = i18n.ts.somethingHappened;
		}
	});
}, { immediate: true });

watch(dimension, (value, previous) => {
	if (value == null || value === previous) return;
	claimAchievement('dimensionConfigured');
});

async function pickDimension(): Promise<void> {
	const selected = await selectDimension(dimension.value);
	if (selected === undefined) return;
	dimension.value = selected;
}

function saveTlDimension(value: number | null): void {
	const dimensionBySrc = { ...(store.s.tl.dimensionBySrc ?? {}) };
	if (value == null) {
		delete dimensionBySrc[dimensionKey.value];
	} else {
		dimensionBySrc[dimensionKey.value] = value;
	}

	const out = deepMerge({ dimensionBySrc }, store.s.tl);
	store.set('tl', out);
}

const users = computed(() => ({
	endpoint: 'roles/users' as const,
	limit: 30,
	params: {
		roleId: props.roleId,
	},
}));

const headerTabs = computed(() => [{
	key: 'users',
	icon: 'ti ti-users',
	title: i18n.ts.users,
}, {
	key: 'timeline',
	icon: 'ti ti-pencil',
	title: i18n.ts.timeline,
}]);

const headerActions = computed(() => {
	const headerItems: PageHeaderItem[] = [];

	if (tab.value === 'timeline' && visible.value && $i) {
		headerItems.push({
			icon: 'ti ti-cube',
			label: dimension.value,
			text: i18n.tsx.dimensionWithNumber({ dimension: dimension.value }),
			handler: pickDimension,
		});
	}

	return headerItems.length > 0 ? headerItems : null;
});

definePage(() => ({
	title: role.value ? role.value.name : (error.value ?? i18n.ts.role),
	icon: 'ti ti-badge',
}));
</script>

<style lang="scss" module>
.root {
	padding: 32px;
	text-align: center;
  align-items: center;
}

.text {
	margin: 0 0 8px 0;
}

.img {
	vertical-align: bottom;
  width: 128px;
	height: 128px;
	margin-bottom: 16px;
	border-radius: 16px;
}
</style>
