<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkContainer :max-height="300" :foldable="true" :onUnfold="unfoldContainer">
	<template #icon><i class="ti ti-photo"></i></template>
	<template #header>{{ i18n.ts.files }}</template>
	<div :class="$style.root">
		<MkLoading v-if="fetching"/>
		<div v-if="!fetching && medias.length > 0" :class="$style.stream">
			<MkNoteMediaGrid v-for="media in medias" :key="media.note.id + media.file.id" :note="media.note"/>
		</div>
		<p v-if="!fetching && medias.length == 0" :class="$style.empty">{{ i18n.ts.nothing }}</p>
	</div>
</MkContainer>
</template>

<script lang="ts" setup>
//FIXME atode naosu

import { onMounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { misskeyApi } from '@/utility/misskey-api.js';
import MkContainer from '@/components/MkContainer.vue';
import { i18n } from '@/i18n.js';
import MkNoteMediaGrid from '@/components/MkNoteMediaGrid.vue';

const props = defineProps<{
	user: Misskey.entities.UserDetailed;
}>();

const emit = defineEmits<{
	(ev: 'unfold'): void;
}>();

const fetching = ref(true);
const medias = ref<{
	note: Misskey.entities.Note;
	file: Misskey.entities.DriveFile;
}[]>([]);

onMounted(() => {
	misskeyApi('users/notes', {
		userId: props.user.id,
		withFiles: true,
		limit: 15,
	}).then(notes => {
		for (const note of notes) {
			for (const file of note.files) {
				medias.value.push({
					note,
					file,
				});
			}
		}
		fetching.value = false;
	});
});
</script>

<style lang="scss" module>
.root {
	padding: 8px;
}

.stream {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
	grid-gap: 6px;
}

.media {
	position: relative;
	height: 128px;
	border-radius: 6px;
	overflow: clip;
}

.empty {
	margin: 0;
	padding: 16px;
	text-align: center;
}
</style>
