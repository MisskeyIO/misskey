<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<div class="_spacer" style="--MI_SPACER-w: 800px;">
		<div class="_gaps">
			<div class="_panel" :class="$style.link">
				<MkA to="/bubble-game">
					<img src="/client-assets/drop-and-fusion/logo.png" style="display: block; max-width: 100%; max-height: 200px; margin: auto;"/>
				</MkA>
			</div>
			<div class="_panel" :class="$style.link">
				<MkA to="/reversi">
					<img src="/client-assets/reversi/logo.png" style="display: block; max-width: 100%; max-height: 200px; margin: auto;"/>
				</MkA>
			</div>
		</div>
		<MkPagination v-slot="{items}" :pagination="featuredPagination">
			<MkChannelPreview v-for="channel in items" :key="channel.id" class="_margin" :channel="channel"/>
		</MkPagination>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { definePage } from '@/page.js';
import MkPagination from '@/components/MkPagination.vue';
import MkChannelPreview from '@/components/MkChannelPreview.vue';

definePage(() => ({
	title: 'Misskey Games',
	icon: 'ti ti-device-gamepad',
}));

const featuredPagination = {
	endpoint: 'channels/featured-games' as const,
	noPaging: true,
};
</script>

<style module>
.link:focus-within {
	outline: 2px solid var(--MI_THEME-focus);
	outline-offset: -2px;
}
</style>
