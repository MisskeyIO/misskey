<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<template v-for="file in files">
	<div
		v-if="shouldHide(file) && !showingFiles.has(file.id)"
		:class="[$style.filePreview, { [$style.square]: square }]"
		@click="showHiddenContent(file)"
	>
		<MkDriveFileThumbnail
			:file="file"
			fit="cover"
			:highlightWhenSensitive="prefer.s.highlightSensitiveMedia"
			:forceBlurhash="true"
			:large="true"
			:class="$style.file"
		/>
		<div :class="$style.sensitive">
			<div>
				<div v-if="file.isSensitive"><i class="ti ti-eye-exclamation"></i> {{ i18n.ts.sensitive }}{{ prefer.s.dataSaver.media && file.size ? ` (${bytes(file.size)})` : '' }}</div>
				<div v-else><i class="ti ti-photo"></i> {{ prefer.s.dataSaver.media && file.size ? bytes(file.size) : i18n.ts.image }}</div>
				<div>{{ i18n.ts.clickToShow }}</div>
			</div>
		</div>
	</div>
	<MkA v-else :class="[$style.filePreview, { [$style.square]: square }]" :to="notePage(note)">
		<MkDriveFileThumbnail
			:file="file"
			fit="cover"
			:highlightWhenSensitive="prefer.s.highlightSensitiveMedia"
			:large="true"
			:class="$style.file"
		/>
	</MkA>
</template>
</template>

<script lang="ts" setup>
import { computed, ref, toRefs } from 'vue';
import * as Misskey from 'misskey-js';
import { notePage } from '@/filters/note.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import bytes from '@/filters/bytes.js';
import { requestSensitiveContentConsent, sensitiveContentConsent } from '@/utility/sensitive-content-consent.js';
import { pleaseLogin } from '@/utility/please-login.js';
import * as os from '@/os.js';
import { $i } from '@/i.js';

import MkDriveFileThumbnail from '@/components/MkDriveFileThumbnail.vue';

const props = defineProps<{
	note: Misskey.entities.Note;
	square?: boolean;
}>();
const { note, square } = toRefs(props);

const showingFiles = ref<Set<string>>(new Set());

const files = computed(() => note.value.files.filter(file => !(file.isSensitive && sensitiveContentConsent.value === false)));

const shouldHide = (file: Misskey.entities.DriveFile): boolean => {
	if (prefer.s.nsfw === 'force' || (prefer.s.dataSaver.media && file.type.startsWith('image/'))) return true;
	if (file.isSensitive && sensitiveContentConsent.value !== true) return true;
	return file.isSensitive && prefer.s.nsfw !== 'ignore';
};

async function showHiddenContent(file: Misskey.entities.DriveFile) {
	if (file.isSensitive && !$i) {
		await pleaseLogin();
		return;
	}

	if (file.isSensitive) {
		const allowed = await requestSensitiveContentConsent();
		if (!allowed) return;
	}

	if (file.isSensitive && prefer.s.confirmWhenRevealingSensitiveMedia) {
		const { canceled } = await os.confirm({
			type: 'question',
			text: i18n.ts.sensitiveMediaRevealConfirm,
		});
		if (canceled) return;
	}

	showingFiles.value.add(file.id);
}
</script>

<style lang="scss" module>
.square {
	width: 100%;
	height: auto;
	aspect-ratio: 1;
}

.filePreview {
	position: relative;
	height: 128px;
	border-radius: calc(var(--MI-radius) / 2);
	overflow: clip;

	&:hover {
		text-decoration: none;
	}

	&.square {
		height: 100%;
	}
}

.file {
	width: 100%;
	height: 100%;
	border-radius: calc(var(--MI-radius) / 2);
}

.sensitive {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	display: grid;
  place-items: center;
	font-size: 0.8em;
	text-align: center;
	padding: 8px;
	box-sizing: border-box;
	color: #fff;
	background: rgba(0, 0, 0, 0.5);
	backdrop-filter: blur(5px);
	cursor: pointer;
}
</style>
