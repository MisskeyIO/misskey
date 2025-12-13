<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" :zPriority="'middle'" :preferType="'dialog'" @closed="$emit('closed')" @click="onBgClick">
	<div ref="rootEl" :class="$style.root">
		<div :class="$style.header">
			<span :class="$style.icon">
				<i v-if="announcement.icon === 'info'" class="ti ti-info-circle"></i>
				<i v-else-if="announcement.icon === 'warning'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i>
				<i v-else-if="announcement.icon === 'error'" class="ti ti-circle-x" style="color: var(--MI_THEME-error);"></i>
				<i v-else-if="announcement.icon === 'success'" class="ti ti-check" style="color: var(--MI_THEME-success);"></i>
			</span>
			<Mfm :text="announcement.title"/>
		</div>
		<div :class="$style.content">
			<Mfm :text="announcement.text"/>
			<img v-if="announcement.imageUrl" :src="announcement.imageUrl"/>
		</div>
		<div ref="bottomEl"></div>
		<div :class="$style.footer">
			<MkButton
				primary
				full
				:disabled="gotItDisabled || !hasReachedBottom"
				@click="gotIt"
			>
				{{ !announcement.needEnrollmentTutorialToRead ? i18n.ts.gotIt : i18n.ts._initialAccountSetting.startTutorial }}
				<span v-if="secVisible"> ({{ sec }})</span>
			</MkButton>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { onMounted, ref, useTemplateRef, defineAsyncComponent } from 'vue';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { updateCurrentAccountPartial } from '@/accounts.js';

const props = defineProps<{
	announcement: Misskey.entities.Announcement;
}>();

const rootEl = useTemplateRef('rootEl');
const bottomEl = useTemplateRef('bottomEl');
const modal = useTemplateRef('modal');
const gotItDisabled = ref(true);
const secVisible = ref(true);
const sec = ref(props.announcement.closeDuration);

async function gotIt(): Promise<void> {
	if (props.announcement.needEnrollmentTutorialToRead) {
		modal.value?.close();
		const tutorialCompleted = await (new Promise<boolean>(async (resolve) => {
			await os.popup(defineAsyncComponent(() => import('@/components/MkTutorialDialog.vue')), {}, {
				done: () => {
					resolve(true);
				},
			}, 'closed');
		}));
		if (!tutorialCompleted) return;
	}

	if (props.announcement.needConfirmationToRead) {
		const confirm = await os.confirm({
			type: 'question',
			title: i18n.ts._announcement.readConfirmTitle,
			text: i18n.tsx._announcement.readConfirmText({ title: props.announcement.title }),
		});
		if (confirm.canceled) return;
	}

	modal.value?.close();
	misskeyApi('i/read-announcement', { announcementId: props.announcement.id });
	updateCurrentAccountPartial({
		unreadAnnouncements: $i!.unreadAnnouncements.filter(a => a.id !== props.announcement.id),
	});
}

function onBgClick() {
	rootEl.value?.animate([{
		offset: 0,
		transform: 'scale(1)',
	}, {
		offset: 0.5,
		transform: 'scale(1.1)',
	}, {
		offset: 1,
		transform: 'scale(1)',
	}], {
		duration: 100,
	});
}

const hasReachedBottom = ref(false);

onMounted(() => {
\tif (sec.value > 0) {
\t\tconst waitTimer = window.setInterval(() => {
\t\t\tif (sec.value === 0) {
\t\t\t\twindow.clearInterval(waitTimer);
\t\t\t\tgotItDisabled.value = false;
\t\t\t\tsecVisible.value = false;
\t\t\t} else {
\t\t\t\tgotItDisabled.value = true;
\t\t\t}
\t\t\tsec.value = sec.value - 1;
\t\t}, 1000);
\t} else {
\t\tgotItDisabled.value = false;
\t\tsecVisible.value = false;
\t}

\tif (bottomEl.value && rootEl.value) {
\t\tconst bottomElRect = bottomEl.value.getBoundingClientRect();
\t\tconst rootElRect = rootEl.value.getBoundingClientRect();
\t\tif (
\t\t\tbottomElRect.top >= rootElRect.top &&
\t\t\tbottomElRect.top <= (rootElRect.bottom - 66) // 66 ≒ 75 * 0.9 (modalのアニメーション分)
\t\t) {
\t\t\thasReachedBottom.value = true;
\t\t\treturn;
\t\t}

\t\tconst observer = new IntersectionObserver(entries => {
\t\t\tfor (const entry of entries) {
\t\t\t\tif (entry.isIntersecting) {
\t\t\t\t\thasReachedBottom.value = true;
\t\t\t\t\tobserver.disconnect();
\t\t\t\t}
\t\t\t}
\t\t}, {
\t\t\troot: rootEl.value,
\t\t\trootMargin: '0px 0px -75px 0px',
\t\t});

\t\tobserver.observe(bottomEl.value);
\t}
});
</script>

<style lang="scss" module>
.root {
	margin: auto;
	position: relative;
	padding: 32px 32px 0;
	min-width: 320px;
	max-width: 480px;
	max-height: 100%;
	overflow-y: auto;
	overflow-x: hidden;
	box-sizing: border-box;
	background: var(--MI_THEME-panel);
	border-radius: var(--MI-radius);
}

.header {
	font-weight: bold;
	font-size: 120%;
}

.icon {
	margin-right: 0.5em;
}

.content {
	margin: 1em 0;
	> img {
		display: block;
		max-height: 300px;
		max-width: 100%;
	}
}

.footer {
	position: sticky;
	bottom: 0;
	left: -32px;
	backdrop-filter: var(--MI-blur, blur(15px));
	background: color(from var(--MI_THEME-bg) srgb r g b / 0.5);
	margin: 0 -32px;
	padding: 24px 32px;
}
</style>
