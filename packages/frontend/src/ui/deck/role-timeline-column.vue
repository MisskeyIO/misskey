<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<XColumn :menu="menu" :column="column" :isStacked="isStacked" :refresher="async () => { await timeline?.reloadTimeline() }">
	<template #header>
		<i class="ti ti-badge"></i><span style="margin-left: 8px;">{{ column.name || roleName || i18n.ts._deck._columns.roleTimeline }}</span>
		<span v-if="column.roleId && dimension > 0" :class="$style.dimensionBadge"><i class="ti ti-cube"></i>{{ dimension }}</span>
	</template>

	<MkTimeline v-if="column.roleId" ref="timeline" src="role" :role="column.roleId" :dimension="dimension" @note="onNote"/>
</XColumn>
</template>

<script lang="ts" setup>
import { onMounted, ref, useTemplateRef, watch, computed } from 'vue';
import XColumn from './column.vue';
import type { Column } from '@/deck.js';
import type { MenuItem } from '@/types/menu.js';
import type { SoundStore } from '@/preferences/def.js';
import { updateColumn } from '@/deck.js';
import MkTimeline from '@/components/MkTimeline.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
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
const dimension = ref<number>(props.column.dimension ?? prefer.s.dimension);
const roleName = ref<string | null>(null);

onMounted(() => {
	if (props.column.roleId == null) {
		setRole();
	}
});

watch([() => props.column.name, () => props.column.roleId], () => {
	if (!props.column.name && props.column.roleId) {
		misskeyApi('roles/show', { roleId: props.column.roleId })
			.then(value => roleName.value = value.name);
	}
});

watch(soundSetting, v => {
	updateColumn(props.column.id, { soundSetting: v });
});

watch(dimension, (value, previous) => {
	updateColumn(props.column.id, { dimension: value });
	if (value != null && value !== previous) {
		claimAchievement('dimensionConfigured');
	}
});

async function pickDimension() {
	const selected = await selectDimension(dimension.value);
	if (selected === undefined) return;
	dimension.value = selected;
}

async function setRole() {
	const roles = (await misskeyApi('roles/list')).filter(x => x.isExplorable);
	const { canceled, result: role } = await os.select({
		title: i18n.ts.role,
		items: roles.map(x => ({
			value: x, text: x.name,
		})),
		default: props.column.roleId,
	});
	if (canceled || role == null) return;
	updateColumn(props.column.id, {
		roleId: role.id,
	});
}

function onNote() {
	sound.playMisskeySfxFile(soundSetting.value);
}

const menu: MenuItem[] = [{
	icon: 'ti ti-cube',
	text: i18n.tsx.dimensionWithNumber({ dimension: dimension.value }),
	action: () => pickDimension,
}, {
	icon: 'ti ti-pencil',
	text: i18n.ts.role,
	action: setRole,
}, {
	icon: 'ti ti-bell',
	text: i18n.ts._deck.newNoteNotificationSettings,
	action: () => soundSettingsButton(soundSetting),
}];

/*
function focus() {
	timeline.focus();
}

defineExpose({
	focus,
});
*/
</script>

<style lang="scss" module>
.dimensionBadge {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	margin-left: 8px;
	font-size: 0.8em;
	opacity: 0.75;
}
</style>
