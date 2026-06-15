<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" :zPriority="'middle'" :preferType="'dialog'" @closed="emit('closed')" @click="onBgClick">
	<div ref="rootEl" :class="$style.root">
		<div :class="$style.header">
			<span :class="$style.icon">
				<i v-if="announcement.icon === 'info'" class="ti ti-info-circle"></i>
				<i v-else-if="announcement.icon === 'warning'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i>
				<i v-else-if="announcement.icon === 'error'" class="ti ti-circle-x" style="color: var(--MI_THEME-error);"></i>
				<i v-else-if="announcement.icon === 'success'" class="ti ti-check" style="color: var(--MI_THEME-success);"></i>
			</span>
			<span :class="$style.title">{{ announcement.title }}</span>
		</div>
		<div :class="$style.text"><Mfm :text="announcement.text"/></div>
		<img v-if="announcement.imageUrl" :class="$style.image" :src="announcement.imageUrl"/>
		<div ref="bottomEl"></div>
		<div :class="$style.footer">
			<MkButton
				primary
				full
				:disabled="!canRead"
				@click="ok"
			>{{ readButtonText }}</MkButton>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import MkTutorialDialog from '@/components/MkTutorialDialog.vue';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { updateCurrentAccountPartial } from '@/accounts.js';

type AnnouncementWithReadGate = Misskey.entities.Announcement & {
	closeDuration?: number | null;
	needEnrollmentTutorialToRead?: boolean;
};

const props = defineProps<{
	announcement: AnnouncementWithReadGate;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const rootEl = useTemplateRef('rootEl');
const bottomEl = useTemplateRef('bottomEl');
const modal = useTemplateRef('modal');
const hasReachedBottom = ref(false);
const remainingCloseDuration = ref(Math.max(0, props.announcement.closeDuration ?? 0));
let closeDurationTimer: number | null = null;

const canRead = computed(() => hasReachedBottom.value && remainingCloseDuration.value === 0);
const readButtonText = computed(() => {
	if (!hasReachedBottom.value) return i18n.ts.scrollToClose;

	const label = props.announcement.needEnrollmentTutorialToRead ? i18n.ts._initialTutorial.launchTutorial : i18n.ts.close;
	return remainingCloseDuration.value > 0 ? `${label} (${remainingCloseDuration.value}s)` : label;
});

async function ok() {
	if (!canRead.value) return;

	if (props.announcement.needConfirmationToRead) {
		const confirm = await os.confirm({
			type: 'question',
			title: i18n.ts._announcement.readConfirmTitle,
			text: i18n.tsx._announcement.readConfirmText({ title: props.announcement.title }),
		});
		if (confirm.canceled) return;
	}

	if (props.announcement.needEnrollmentTutorialToRead) {
		const done = await waitTutorialDone();
		if (!done) return;
	}

	modal.value?.close();
	misskeyApi('i/read-announcement', { announcementId: props.announcement.id });
	updateCurrentAccountPartial({
		unreadAnnouncements: $i!.unreadAnnouncements.filter(a => a.id !== props.announcement.id),
	});
}

function waitTutorialDone(): Promise<boolean> {
	return new Promise(resolve => {
		let resolved = false;
		const { dispose } = os.popup(MkTutorialDialog, {}, {
			done: () => {
				resolved = true;
				resolve(true);
			},
			closed: () => {
				dispose();
				if (!resolved) resolve(false);
			},
		});
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

onMounted(() => {
	if (remainingCloseDuration.value > 0) {
		closeDurationTimer = window.setInterval(() => {
			remainingCloseDuration.value = Math.max(0, remainingCloseDuration.value - 1);
			if (remainingCloseDuration.value === 0 && closeDurationTimer != null) {
				window.clearInterval(closeDurationTimer);
				closeDurationTimer = null;
			}
		}, 1000);
	}

	if (bottomEl.value && rootEl.value) {
		const bottomElRect = bottomEl.value.getBoundingClientRect();
		const rootElRect = rootEl.value.getBoundingClientRect();
		if (
			bottomElRect.top >= rootElRect.top &&
			bottomElRect.top <= (rootElRect.bottom - 66) // 66 ≒ 75 * 0.9 (modalのアニメーション分)
		) {
			hasReachedBottom.value = true;
			return;
		}

		const observer = new IntersectionObserver(entries => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					hasReachedBottom.value = true;
					observer.disconnect();
				}
			}
		}, {
			root: rootEl.value,
			rootMargin: '0px 0px -75px 0px',
		});

		observer.observe(bottomEl.value);
	}
});

onUnmounted(() => {
	if (closeDurationTimer != null) window.clearInterval(closeDurationTimer);
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
	font-size: 120%;
}

.icon {
	margin-right: 0.5em;
}

.title {
	font-weight: bold;
}

.text {
	margin: 1em 0;
}

.image {
	display: block;
	max-height: 300px;
	max-width: 100%;
	margin: 1em 0;
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
