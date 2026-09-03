<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 1200px;">
	<MkFoldableSection class="_margin" persistKey="explore-pinned-users">
		<template #header><i class="ti ti-bookmark ti-fw" style="margin-right: 0.5em;"></i>{{ i18n.ts.pinnedUsers }}</template>
		<MkUserList :paginator="pinnedUsersPaginator"/>
	</MkFoldableSection>
	<MkFoldableSection class="_margin" persistKey="explore-popular-users">
		<template #header><i class="ti ti-chart-line ti-fw" style="margin-right: 0.5em;"></i>{{ i18n.ts.popularUsers }}</template>
		<MkUserList :paginator="popularUsersPaginator"/>
	</MkFoldableSection>
</div>
</template>

<script lang="ts" setup>
import { markRaw } from 'vue';
import MkUserList from '@/components/MkUserList.vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';

const pinnedUsersPaginator = markRaw(new Paginator('pinned-users', {
	noPaging: true,
}));

const popularUsersPaginator = markRaw(new Paginator('users', {
	limit: 30,
	noPaging: true,
	params: {
		state: 'alive',
		origin: 'local',
		sort: '+pv',
	},
}));
</script>
