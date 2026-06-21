<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<MkInput
		v-model="searchQuery"
		:placeholder="i18n.ts._chat.searchMessages"
		type="search"
		@enter="search()"
	>
		<template #prefix><i class="ti ti-search"></i></template>
	</MkInput>

	<MkButton primary rounded @click="search">{{ i18n.ts.search }}</MkButton>

	<MkFoldableSection v-if="searched">
		<template #header>{{ i18n.ts.searchResult }}</template>

		<div v-if="searchResults.length > 0" class="_gaps_s">
			<MkNote v-for="note in searchResults" :key="note.id" :note="note" :withHardMute="true"/>
		</div>
		<MkResult v-else type="notFound"/>
	</MkFoldableSection>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import MkButton from '@/components/MkButton.vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import MkInput from '@/components/MkInput.vue';
import MkNote from '@/components/MkNote.vue';
import { i18n } from '@/i18n.js';
import { ensureSignin } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const $i = ensureSignin();

const props = defineProps<{
	userId?: string;
	roomId?: string;
}>();

const searchQuery = ref('');
const searched = ref(false);
const searchResults = ref<Misskey.entities.Note[]>([]);

function isDirectNoteWithUser(note: Misskey.entities.Note): boolean {
	if (props.userId == null) return true;
	return note.userId === props.userId || (note.userId === $i.id && (note.visibleUserIds?.includes(props.userId) ?? false));
}

async function search() {
	const res = await misskeyApi('notes/mentions', {
		limit: 100,
		visibility: 'specified',
	});

	const query = searchQuery.value.trim().toLowerCase();
	searchResults.value = res.filter(note => isDirectNoteWithUser(note) && (query === '' || note.text?.toLowerCase().includes(query)));
	searched.value = true;
}
</script>
