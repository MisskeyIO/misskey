<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :reversed="true">
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<div class="_gaps">
			<MkInfo v-if="roomId" warn>{{ i18n.ts._chat.chatNotAvailableForThisAccountOrServer }}</MkInfo>

			<div v-if="initializing">
				<MkLoading/>
			</div>

			<template v-else-if="user">
				<div v-if="notes.length === 0" class="_gaps" style="text-align: center;">
					<div>{{ i18n.ts._chat.noMessagesYet }}</div>
				</div>

				<div v-else class="_gaps">
					<MkNote v-for="note in notes" :key="note.id" :note="note" :withHardMute="true"/>
				</div>

				<MkButton v-if="canFetchMore" :class="$style.more" :wait="moreFetching" primary rounded @click="fetchMore">{{ i18n.ts.loadMore }}</MkButton>
			</template>
		</div>
	</div>

	<template #footer>
		<div v-if="user" :class="$style.footer">
			<MkButton primary gradate rounded :class="$style.form" @click="composeDirectMessage"><i class="ti ti-send"></i> {{ i18n.ts.send }}</MkButton>
		</div>
	</template>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import * as Misskey from 'misskey-js';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkNote from '@/components/MkNote.vue';
import { i18n } from '@/i18n.js';
import { ensureSignin } from '@/i.js';
import { definePage } from '@/page.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const $i = ensureSignin();

const props = defineProps<{
	userId?: string;
	roomId?: string;
}>();

const initializing = ref(false);
const moreFetching = ref(false);
const notes = ref<Misskey.entities.Note[]>([]);
const canFetchMore = ref(false);
const user = ref<Misskey.entities.UserDetailed | null>(null);

const NOTE_FETCH_LIMIT = 100;
const DIRECT_NOTE_DISPLAY_LIMIT = 20;

function isDirectNoteWithUser(note: Misskey.entities.Note): boolean {
	if (props.userId == null) return false;
	return note.userId === props.userId || (note.userId === $i.id && (note.visibleUserIds?.includes(props.userId) ?? false));
}

async function fetchDirectNotes(untilId?: string): Promise<Misskey.entities.Note[]> {
	const result = await misskeyApi('notes/mentions', {
		limit: NOTE_FETCH_LIMIT,
		visibility: 'specified',
		untilId,
	});

	canFetchMore.value = result.length === NOTE_FETCH_LIMIT;
	return result.filter(isDirectNoteWithUser).slice(0, DIRECT_NOTE_DISPLAY_LIMIT);
}

async function initialize() {
	if (initializing.value) return;

	initializing.value = true;
	canFetchMore.value = false;
	notes.value = [];
	user.value = null;

	if (props.userId != null) {
		const [u, directNotes] = await Promise.all([
			misskeyApi('users/show', { userId: props.userId }),
			fetchDirectNotes(),
		]);

		user.value = u;
		notes.value = directNotes;
	}

	initializing.value = false;
}

async function fetchMore() {
	const untilId = notes.value.at(-1)?.id;
	if (untilId == null) return;

	moreFetching.value = true;
	notes.value.push(...await fetchDirectNotes(untilId));
	moreFetching.value = false;
}

function composeDirectMessage() {
	if (user.value == null) return;
	os.post({
		specified: user.value,
		initialVisibility: 'specified',
	});
}

onMounted(() => {
	initialize();
});

watch(() => props.userId, () => {
	initialize();
});

definePage(computed(() => {
	if (user.value != null) {
		return {
			userName: user.value,
			title: user.value.name ?? user.value.username,
			avatar: user.value,
		};
	}

	return {
		title: i18n.ts.directMessage,
		icon: 'ti ti-messages',
	};
}));
</script>

<style lang="scss" module>
.more {
	margin: 0 auto;
}

.footer {
	width: 100%;
	padding-top: 8px;
}

.form {
	margin: 0 auto;
}
</style>
