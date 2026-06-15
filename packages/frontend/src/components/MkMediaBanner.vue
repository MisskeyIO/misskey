<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="!blocked" :class="[$style.root, (media.isSensitive && prefer.s.highlightSensitiveMedia) && $style.sensitive]">
	<div v-if="media.isSensitive && hide" :class="$style.sensitiveHidden" @click="showHiddenContent">
		<span style="font-size: 1.6em;"><i class="ti ti-alert-triangle"></i></span>
		<b>{{ i18n.ts.sensitive }}</b>
		<span>{{ i18n.ts.clickToShow }}</span>
	</div>
	<MkMediaAudio v-else-if="media.type.startsWith('audio') && media.type !== 'audio/midi'" :audio="media" :user="user"/>
	<a
		v-else :class="$style.download"
		:href="media.url"
		:title="media.name"
		:download="media.name"
	>
		<span style="font-size: 1.6em;"><i class="ti ti-download"></i></span>
		<b>{{ media.name }}</b>
	</a>
</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n.js';
import MkMediaAudio from '@/components/MkMediaAudio.vue';
import { canRevealFile } from '@/utility/sensitive-file.js';
import { pleaseLogin } from '@/utility/please-login.js';
import { sensitiveContentConsent, requestSensitiveContentConsent } from '@/utility/sensitive-content-consent.js';
import { $i } from '@/i.js';
import { prefer } from '@/preferences.js';

const props = defineProps<{
	media: Misskey.entities.DriveFile;
	user?: Misskey.entities.UserLite;
}>();

const blocked = computed(() => props.media.isSensitive && sensitiveContentConsent.value === false);

function calcHide(): boolean {
	if (prefer.s.nsfw === 'force' || prefer.s.dataSaver.media) return true;
	if (props.media.isSensitive && sensitiveContentConsent.value !== true) return true;
	return props.media.isSensitive && prefer.s.nsfw !== 'ignore';
}

const hide = ref(calcHide());

async function showHiddenContent(ev: MouseEvent) {
	if (!hide.value) return;

	ev.preventDefault();
	ev.stopPropagation();

	if (props.media.isSensitive && !$i) {
		await pleaseLogin();
		return;
	}

	if (props.media.isSensitive && sensitiveContentConsent.value !== true) {
		const allowed = await requestSensitiveContentConsent();
		if (!allowed) return;
	}

	if (!(await canRevealFile(props.media))) return;

	hide.value = false;
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	width: 100%;
	border-radius: 4px;
	margin-top: 4px;
	overflow: clip;
}

.download,
.sensitiveHidden {
	display: flex;
	align-items: center;
	font-size: 12px;
	padding: 8px 12px;
	white-space: nowrap;
}

.download {
}

.sensitive {
	&::after {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		border-radius: inherit;
		box-shadow: inset 0 0 0 4px var(--MI_THEME-warn);
	}
}

.sensitiveHidden {
	background: #111;
	color: #fff;
}

.audio {
	border-radius: 8px;
	overflow: clip;
}
</style>
