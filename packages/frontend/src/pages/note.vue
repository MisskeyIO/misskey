<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :contentMax="800">
		<div>
			<Transition :name="defaultStore.state.animation ? 'fade' : ''" mode="out-in">
				<div v-if="note">
					<div v-if="showNext" class="_margin">
						<MkNotes class="" :pagination="showNext === 'channel' ? nextChannelPagination : nextUserPagination" :noGap="true" :disableAutoLoad="true"/>
					</div>

					<div class="_margin">
						<div v-if="!showNext" class="_buttons" :class="$style.loadNext">
							<MkButton v-if="note.channelId" rounded :class="$style.loadButton" @click="showNext = 'channel'"><i class="ti ti-chevron-up"></i> <i class="ti ti-device-tv"></i></MkButton>
							<MkButton rounded :class="$style.loadButton" @click="showNext = 'user'"><i class="ti ti-chevron-up"></i> <i class="ti ti-user"></i></MkButton>
						</div>
						<div class="_margin _gaps_s">
							<MkRemoteCaution v-if="note.user.host != null" :href="note.url ?? note.uri"/>
							<MkInfo v-if="hasSensitiveFiles" :warn="true">
								<Mfm :text="i18n.ts.sensitiveByModerator"/>
							</MkInfo>
							<MkNoteDetailed :key="note.id" v-model:note="note" :initialTab="initialTab" :class="$style.note"/>
						</div>
						<div v-if="clips && clips.length > 0" class="_margin">
							<div style="font-weight: bold; padding: 12px;">{{ i18n.ts.clip }}</div>
							<div class="_gaps">
								<MkClipPreview v-for="item in clips" :key="item.id" :clip="item"/>
							</div>
						</div>
						<div v-if="!showPrev" class="_buttons" :class="$style.loadPrev">
							<MkButton v-if="note.channelId" rounded :class="$style.loadButton" @click="showPrev = 'channel'"><i class="ti ti-chevron-down"></i> <i class="ti ti-device-tv"></i></MkButton>
							<MkButton rounded :class="$style.loadButton" @click="showPrev = 'user'"><i class="ti ti-chevron-down"></i> <i class="ti ti-user"></i></MkButton>
						</div>
					</div>

					<div v-if="showPrev" class="_margin">
						<MkNotes class="" :pagination="showPrev === 'channel' ? prevChannelPagination : prevUserPagination" :noGap="true"/>
					</div>
				</div>
				<MkError v-else-if="error" @retry="fetchNote()"/>
				<MkLoading v-else/>
			</Transition>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, watch, ref } from 'vue';
import * as Misskey from 'misskey-js';
import type { Paging } from '@/components/MkPagination.vue';
import MkNoteDetailed from '@/components/MkNoteDetailed.vue';
import MkNotes from '@/components/MkNotes.vue';
import MkRemoteCaution from '@/components/MkRemoteCaution.vue';
import MkButton from '@/components/MkButton.vue';
import { misskeyApi } from '@/scripts/misskey-api.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import { i18n } from '@/i18n.js';
import { dateString } from '@/filters/date.js';
import MkClipPreview from '@/components/MkClipPreview.vue';
import { defaultStore } from '@/store.js';
import MkInfo from '@/components/MkInfo.vue';
import { $i } from '@/account.js';

const props = defineProps<{
	noteId: string;
	initialTab?: string;
}>();

const note = ref<null | Misskey.entities.Note>();
const clips = ref<Misskey.entities.Clip[]>();
const hasSensitiveFiles = ref(false);
const showPrev = ref<'user' | 'channel' | false>(false);
const showNext = ref<'user' | 'channel' | false>(false);
const error = ref();

const prevUserPagination: Paging = {
	endpoint: 'users/notes',
	limit: 10,
	params: computed(() => note.value ? ({
		userId: note.value.userId,
		untilId: note.value.id,
	}) : undefined),
};

const nextUserPagination: Paging = {
	prepend: true,
	endpoint: 'users/notes',
	limit: 10,
	params: computed(() => note.value ? ({
		userId: note.value.userId,
		sinceId: note.value.id,
	}) : undefined),
};

const prevChannelPagination: Paging = {
	endpoint: 'channels/timeline',
	limit: 10,
	params: computed(() => note.value ? ({
		channelId: note.value.channelId,
		untilId: note.value.id,
	}) : undefined),
};

const nextChannelPagination: Paging = {
	prepend: true,
	endpoint: 'channels/timeline',
	limit: 10,
	params: computed(() => note.value ? ({
		channelId: note.value.channelId,
		sinceId: note.value.id,
	}) : undefined),
};

function fetchNote() {
	showPrev.value = false;
	showNext.value = false;
	note.value = null;
	misskeyApi('notes/show', {
		noteId: props.noteId,
	}).then(res => {
		note.value = res;

		if (note.value.userId === $i?.id && note.value.fileIds) {
			Promise.all(note.value.fileIds.map(fileId =>
				misskeyApi('drive/files/show', { fileId: fileId }),
			)).then(files => {
				hasSensitiveFiles.value = files.some(file => file.isSensitiveByModerator);
			});
		}

		// 古いノートは被クリップ数をカウントしていないので、2023-10-01以前のものは強制的にnotes/clipsを叩く
		if (note.value.clippedCount > 0 || new Date(note.value.createdAt).getTime() < new Date('2023-10-01').getTime()) {
			misskeyApi('notes/clips', {
				noteId: note.value.id,
			}).then((_clips) => {
				clips.value = _clips;
			});
		}
	}).catch(err => {
		error.value = err;
	});
}

watch(() => props.noteId, fetchNote, {
	immediate: true,
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePageMetadata(() => ({
	title: i18n.ts.note,
	...note.value ? {
		subtitle: dateString(note.value.createdAt),
		avatar: note.value.user,
		path: `/notes/${note.value.id}`,
		share: {
			title: i18n.tsx.noteOf({ user: note.value.user.name }),
			text: note.value.text,
		},
	} : {},
}));
</script>

<style lang="scss" module>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.125s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.loadNext,
.loadPrev {
	justify-content: center;
}

.loadNext {
	margin-bottom: var(--margin);
}

.loadPrev {
	margin-top: var(--margin);
}

.loadButton {
	min-width: 0;
}

.note {
	border-radius: var(--radius);
	background: var(--panel);
}
</style>
