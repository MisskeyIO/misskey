<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkWindow
	ref="window"
	:initialWidth="300"
	:initialHeight="290"
	:canResize="true"
	:mini="true"
	:front="true"
	@closed="emit('closed')"
>
	<MkEmojiPicker
		:class="$style.picker"
		:showPinned="showPinned"
		:pinnedEmojis="pinnedEmojis"
		:asReactionPicker="asReactionPicker"
		:targetNote="targetNote"
		asWindow
		@chosen="chosen"
	/>
</MkWindow>
</template>

<script lang="ts" setup>
import * as Misskey from 'misskey-js';
import MkWindow from '@/components/MkWindow.vue';
import MkEmojiPicker from '@/components/MkEmojiPicker.vue';

withDefaults(defineProps<{
	anchorElement?: HTMLElement | null;
	showPinned?: boolean;
	pinnedEmojis?: string[];
	asReactionPicker?: boolean;
	targetNote?: Misskey.entities.Note | null;
}>(), {
	showPinned: true,
	asReactionPicker: false,
	targetNote: null,
});

const emit = defineEmits<{
	(ev: 'chosen', v: string): void;
	(ev: 'closed'): void;
}>();

function chosen(emoji: string) {
	emit('chosen', emoji);
}
</script>

<style lang="scss" module>
.picker {
	height: 100%;
}
</style>
