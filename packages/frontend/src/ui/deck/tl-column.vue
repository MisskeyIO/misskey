<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<XColumn :menu="menu" :column="column" :isStacked="isStacked" :refresher="async () => { await timeline?.reloadTimeline() }">
	<template #header>
		<i v-if="column.tl != null" :class="basicTimelineIconClass(column.tl)"/>
		<span style="margin-left: 8px;">{{ column.name || (column.tl ? i18n.ts._timelines[column.tl] : null) || i18n.ts._deck._columns.tl }}</span>
		<span v-if="column.tl != null && hasDimension(column.tl) && dimension > 0" :class="$style.dimensionBadge"><i class="ti ti-cube"></i>{{ dimension }}</span>
	</template>

	<div v-if="!isAvailableBasicTimeline(column.tl)" :class="$style.disabled">
		<p :class="$style.disabledTitle">
			<i class="ti ti-circle-minus"></i>
			{{ i18n.ts._disabledTimeline.title }}
		</p>
		<p :class="$style.disabledDescription">{{ i18n.ts._disabledTimeline.description }}</p>
	</div>
	<MkTimeline
		v-else-if="column.tl"
		ref="timeline"
		:key="column.tl + withRenotes + withReplies + onlyFiles + dimension"
		:src="column.tl"
		:withRenotes="withRenotes"
		:withReplies="withReplies"
		:withSensitive="withSensitive"
		:onlyFiles="onlyFiles"
		:dimension="dimension"
		@note="onNote"
	/>
</XColumn>
</template>

<script lang="ts" setup>
import { onMounted, watch, ref, useTemplateRef, computed } from 'vue';
import XColumn from './column.vue';
import type { Column } from '@/deck.js';
import type { MenuItem } from '@/types/menu.js';
import type { SoundStore } from '@/preferences/def.js';
import { removeColumn, updateColumn } from '@/deck.js';
import MkTimeline from '@/components/MkTimeline.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { hasWithReplies, hasDimension, isAvailableBasicTimeline, basicTimelineIconClass } from '@/timelines.js';
import { soundSettingsButton } from '@/ui/deck/tl-note-notification.js';
import * as sound from '@/utility/sound.js';
import { selectDimension } from '@/utility/dimension.js';
import { claimAchievement } from '@/utility/achievements.js';
import { prefer } from '@/preferences.js';

const props = defineProps<{
	column: Column;
	isStacked: boolean;
}>();

const timeline = useTemplateRef('timeline');

const soundSetting = ref<SoundStore>(props.column.soundSetting ?? { type: null, volume: 1 });
const withRenotes = ref(props.column.withRenotes ?? true);
const withReplies = ref(props.column.withReplies ?? false);
const withSensitive = ref(props.column.withSensitive ?? true);
const onlyFiles = ref(props.column.onlyFiles ?? false);
const dimension = ref<number>(props.column.dimension ?? prefer.s.dimension);

watch(withRenotes, v => {
	updateColumn(props.column.id, {
		withRenotes: v,
	});
});

watch(withReplies, v => {
	updateColumn(props.column.id, {
		withReplies: v,
	});
});

watch(withSensitive, v => {
	updateColumn(props.column.id, {
		withSensitive: v,
	});
});

watch(onlyFiles, v => {
	updateColumn(props.column.id, {
		onlyFiles: v,
	});
});

watch(dimension, (value, previous) => {
	updateColumn(props.column.id, {
		dimension: value,
	});
	if (value != null && value !== previous) {
		claimAchievement('dimensionConfigured');
	}
});

async function pickDimension() {
	const selected = await selectDimension(dimension.value);
	if (selected === undefined) return;
	dimension.value = selected;
}

watch(soundSetting, v => {
	updateColumn(props.column.id, { soundSetting: v });
});

onMounted(() => {
	if (props.column.tl == null) {
		setType();
	}
});

async function setType() {
	const { canceled, result: src } = await os.select({
		title: i18n.ts.timeline,
		items: [{
			value: 'home' as const, text: i18n.ts._timelines.home,
		}, {
			value: 'local' as const, text: i18n.ts._timelines.local,
		}, {
			value: 'media' as const, text: i18n.ts._timelines.media,
		}, {
			value: 'social' as const, text: i18n.ts._timelines.social,
		}, {
			value: 'global' as const, text: i18n.ts._timelines.global,
		}],
	});
	if (canceled) {
		if (props.column.tl == null) {
			removeColumn(props.column.id);
		}
		return;
	}
	if (src == null) return;
	updateColumn(props.column.id, {
		tl: src ?? undefined,
	});
}

function onNote() {
	sound.playMisskeySfxFile(soundSetting.value);
}

const menu = computed<MenuItem[]>(() => {
	const menuItems: MenuItem[] = [];

	if (hasDimension(props.column.tl)) {
		menuItems.push({
			icon: 'ti ti-cube',
			text: i18n.tsx.dimensionWithNumber({ dimension: dimension.value }),
			action: pickDimension,
		});
	}

	menuItems.push({
		icon: 'ti ti-pencil',
		text: i18n.ts.timeline,
		action: setType,
	}, {
		icon: 'ti ti-bell',
		text: i18n.ts._deck.newNoteNotificationSettings,
		action: () => soundSettingsButton(soundSetting),
	}, {
		type: 'switch',
		text: i18n.ts.showRenotes,
		ref: withRenotes,
	});

	if (hasWithReplies(props.column.tl)) {
		menuItems.push({
			type: 'switch',
			text: i18n.ts.showRepliesToOthersInTimeline,
			ref: withReplies,
			disabled: onlyFiles,
		});
	}

	menuItems.push({
		type: 'switch',
		text: i18n.ts.fileAttachedOnly,
		ref: onlyFiles,
		disabled: hasWithReplies(props.column.tl) ? withReplies : false,
	}, {
		type: 'switch',
		text: i18n.ts.withSensitive,
		ref: withSensitive,
	});

	return menuItems;
});
</script>

<style lang="scss" module>
.disabled {
	text-align: center;
}

.dimensionBadge {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	margin-left: 8px;
	font-size: 0.8em;
	opacity: 0.75;
}

.disabledTitle {
	margin: 16px;
}

.disabledDescription {
	font-size: 90%;
}
</style>
