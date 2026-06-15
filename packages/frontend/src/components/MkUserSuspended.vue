<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition :name="prefer.s.animation ? '_transition_zoom' : ''" appear>
	<div :class="$style.root">
		<img :class="$style.img" :src="serverErrorImageUrl" class="_ghost"/>
		<p :class="$style.text"><i class="ti ti-alert-triangle"></i> {{ i18n.ts.userSuspended }}</p>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';

const serverErrorImageUrl = instance.serverErrorImageUrl ?? 'https://xn--931a.moe/assets/error.jpg';

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
