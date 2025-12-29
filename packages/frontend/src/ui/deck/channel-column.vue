<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<XColumn :menu="menu" :column="column" :isStacked="isStacked" :refresher="async () => { await timeline?.reloadTimeline() }">
	<template #header>
		<i class="ti ti-device-tv"></i><span style="margin-left: 8px;">{{ column.name || channel?.name || i18n.ts._deck._columns.channel }}</span>
		<span v-if="column.channelId && dimension > 0" :class="$style.dimensionBadge"><i class="ti ti-cube"></i>{{ dimension }}</span>
	</template>

	<template v-if="column.channelId">
		<div style="padding: 8px; text-align: center;">
			<MkButton primary gradate rounded inline small @click="post"><i class="ti ti-pencil"></i></MkButton>
		</div>
		<MkTimeline ref="timeline" src="channel" :channel="column.channelId" :dimension="dimension" @note="onNote"/>
	</template>
</XColumn>
</template>

<script lang="ts" setup>
import { onMounted, ref, shallowRef, watch, useTemplateRef, computed } from 'vue';
import * as Misskey from 'misskey-js';
import XColumn from './column.vue';
import type { Column } from '@/deck.js';
import type { MenuItem } from '@/types/menu.js';
import type { SoundStore } from '@/preferences/def.js';
import { updateColumn } from '@/deck.js';
import MkTimeline from '@/components/MkTimeline.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { favoritedChannelsCache } from '@/cache.js';
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
const channel = shallowRef<Misskey.entities.Channel>();
const soundSetting = ref<SoundStore>(props.column.soundSetting ?? { type: null, volume: 1 });
const dimension = ref<number>(props.column.dimension ?? prefer.s.dimension);

onMounted(() => {
	if (props.column.channelId == null) {
		setChannel();
	}
});

watch([() => props.column.name, () => props.column.channelId], () => {
	if (!props.column.name && props.column.channelId) {
		misskeyApi('channels/show', { channelId: props.column.channelId })
			.then(value => channel.value = value);
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

async function setChannel() {
	const channels = await favoritedChannelsCache.fetch();
	const { canceled, result: chosenChannel } = await os.select({
		title: i18n.ts.selectChannel,
		items: channels.map(x => ({
			value: x, text: x.name,
		})),
		default: props.column.channelId,
	});
	if (canceled || chosenChannel == null) return;
	updateColumn(props.column.id, {
		channelId: chosenChannel.id,
		name: chosenChannel.name,
	});
}

async function post() {
	if (props.column.channelId == null) return;
	if (!channel.value || channel.value.id !== props.column.channelId) {
		channel.value = await misskeyApi('channels/show', {
			channelId: props.column.channelId,
		});
	}

	os.post({
		channel: channel.value,
		initialDimension: dimension.value,
	});
}

function onNote() {
	sound.playMisskeySfxFile(soundSetting.value);
}

const menu: MenuItem[] = [{
	icon: 'ti ti-cube',
	text: i18n.tsx.dimensionWithNumber({ dimension: dimension.value }),
	action: pickDimension,
}, {
	icon: 'ti ti-pencil',
	text: i18n.ts.selectChannel,
	action: setChannel,
}, {
	icon: 'ti ti-bell',
	text: i18n.ts._deck.newNoteNotificationSettings,
	action: () => soundSettingsButton(soundSetting),
}];
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
