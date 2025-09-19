<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialog"
	:width="800"
	:height="500"
	:withOkButton="true"
	:okButtonDisabled="(type === 'file') && (selected.length === 0)"
	@click="cancel()"
	@close="cancel()"
	@ok="ok()"
	@closed="emit('closed')"
>
	<template #header>
		{{ multiple ? ((type === 'file') ? i18n.ts.selectFiles : i18n.ts.selectFolders) : ((type === 'file') ? i18n.ts.selectFile : i18n.ts.selectFolder) }}
		<span v-if="selected.length > 0" style="margin-left: 8px; opacity: 0.5;">({{ number(selected.length) }})</span>
	</template>
	<XDrive :multiple="multiple" :select="type" @cd="onCd" @change-selection="onChangeSelection" @selected="ok()"/>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { ref, toRef, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import XDrive from '@/components/MkDrive.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import number from '@/filters/number.js';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	type?: 'file' | 'folder';
	multiple: boolean;
}>(), {
	type: 'file',
});

const type = toRef(props, 'type');
const multiple = toRef(props, 'multiple');

const emit = defineEmits<{
	(ev: 'done', r?: Misskey.entities.DriveFile[] | Misskey.entities.DriveFolder[]): void;
	(ev: 'closed'): void;
}>();

const dialog = useTemplateRef('dialog');

const selected = ref<Misskey.entities.DriveFile[] | Misskey.entities.DriveFolder[]>([]);
const currentFolder = ref<Misskey.entities.DriveFolder | null>(null);

function ok() {
	let result: Misskey.entities.DriveFile[] | Misskey.entities.DriveFolder[] = selected.value;

	if (type.value === 'folder') {
		const folders = selected.value as Misskey.entities.DriveFolder[];
		if (folders.length === 0 && currentFolder.value) {
			result = [currentFolder.value];
		}
	}

	emit('done', result);
	dialog.value?.close();
}

function cancel() {
	emit('done');
	dialog.value?.close();
}

function onChangeSelection(v: Misskey.entities.DriveFile[] | Misskey.entities.DriveFolder[]) {
	selected.value = v;
}

function onCd(folder: Misskey.entities.DriveFolder | null) {
	currentFolder.value = folder;
}
</script>
