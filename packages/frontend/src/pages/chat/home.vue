<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs" :swipable="true">
	<MkPolkadots v-if="tab === 'home'" accented :height="200" style="margin-bottom: -200px;"/>
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<XHome v-if="tab === 'home'"/>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import XHome from './home.home.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkPolkadots from '@/components/MkPolkadots.vue';

const tab = ref('home');

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'home',
	title: i18n.ts._chat.home,
	icon: 'ti ti-home',
}]);

definePage(() => ({
	title: i18n.ts.directMessage,
	icon: 'ti ti-messages',
}));
</script>

<style lang="scss" module>
</style>
