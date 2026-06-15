<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" :style="visualStyle">
	<MkAvatar :user="user" :class="$style.avatar"/>
	<div :class="$style.bars" aria-hidden="true">
		<span v-for="i in 12" :key="i" :class="$style.bar"></span>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import * as Misskey from 'misskey-js';

defineProps<{
	audioEl: HTMLAudioElement | null;
	analyser: AnalyserNode | null;
	user: Misskey.entities.UserLite;
	profileImage: string | null;
}>();

const paused = ref(false);

const visualStyle = computed(() => ({
	animationPlayState: paused.value ? 'paused' : 'running',
}));

function pauseAnimation(): void {
	paused.value = true;
}

function resumeAnimation(): void {
	paused.value = false;
}

defineExpose({
	pauseAnimation,
	resumeAnimation,
});
</script>

<style lang="scss" module>
.root {
	position: relative;
	min-height: 140px;
	display: grid;
	place-items: center;
	overflow: hidden;
	background: radial-gradient(circle at 50% 35%, color(from var(--MI_THEME-accent) srgb r g b / 0.28), transparent 58%), var(--MI_THEME-panel);
}

.avatar {
	width: 72px;
	height: 72px;
	z-index: 1;
	box-shadow: 0 16px 42px color(from var(--MI_THEME-shadow) srgb r g b / 0.32);
}

.bars {
	position: absolute;
	inset: auto 18px 18px;
	display: flex;
	align-items: end;
	justify-content: center;
	gap: 5px;
}

.bar {
	width: 5px;
	height: 24px;
	border-radius: 999px;
	background: color(from var(--MI_THEME-accent) srgb r g b / 0.62);
	animation: audioBar 1.1s ease-in-out infinite alternate;
	animation-play-state: inherit;
}

.bar:nth-child(2n) {
	height: 42px;
	animation-delay: -0.35s;
}

.bar:nth-child(3n) {
	height: 32px;
	animation-delay: -0.7s;
}

@keyframes audioBar {
	from { transform: scaleY(0.45); opacity: 0.45; }
	to { transform: scaleY(1); opacity: 1; }
}
</style>
