<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkNoteDraftsDialog
	@restore="restore"
	@cancel="cancel"
	@closed="emit('closed')"
/>
</template>

<script lang="ts" setup>
import * as Misskey from 'misskey-js';
import MkNoteDraftsDialog from '@/components/MkNoteDraftsDialog.vue';

const emit = defineEmits<{
	(ev: 'done', v: { canceled: true } | { canceled: false; selected: string | undefined }): void;
	(ev: 'closed'): void;
}>();

function restore(draft: Misskey.entities.NoteDraft) {
	emit('done', { canceled: false, selected: draft.id });
}

function cancel() {
	emit('done', { canceled: true });
}
</script>
