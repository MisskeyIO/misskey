<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkContainer :showHeader="widgetProps.showHeader" :style="`height: ${widgetProps.height}px;`" :scrollable="true" data-cy-mkw-timeline class="mkw-timeline">
	<template #icon>
		<i v-if="isBasicTimeline(widgetProps.src)" :class="basicTimelineIconClass(widgetProps.src)"></i>
		<i v-else-if="widgetProps.src === 'list'" class="ti ti-list"></i>
		<i v-else-if="widgetProps.src === 'antenna'" class="ti ti-antenna"></i>
	</template>
	<template #header>
		<button class="_button" @click="choose">
			<span>{{ selectedTimelineLabel }}</span>
			<i :class="menuOpened ? 'ti ti-chevron-up' : 'ti ti-chevron-down'" style="margin-left: 8px;"></i>
		</button>
	</template>

	<div v-if="isBasicTimeline(widgetProps.src) && !isAvailableBasicTimeline(widgetProps.src)" :class="$style.disabled">
		<p :class="$style.disabledTitle">
			<i class="ti ti-minus"></i>
			{{ i18n.ts._disabledTimeline.title }}
		</p>
		<p :class="$style.disabledDescription">{{ i18n.ts._disabledTimeline.description }}</p>
	</div>
	<div v-else>
		<MkTimeline :key="timelineKey" :src="widgetProps.src" :list="listId" :antenna="antennaId"/>
	</div>
</MkContainer>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { Form, GetFormResultType } from '@/utility/form.js';
import type { MenuItem } from '@/types/menu.js';
import type { AllTimelineType, BasicTimelineType } from '@/timelines.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import MkContainer from '@/components/MkContainer.vue';
import MkTimeline from '@/components/MkTimeline.vue';
import { i18n } from '@/i18n.js';
import { availableBasicTimelines, isAvailableBasicTimeline, isBasicTimeline, basicTimelineIconClass } from '@/timelines.js';

const name = 'timeline';

const widgetPropsDef = {
	showHeader: {
		type: 'boolean' as const,
		default: true,
	},
	height: {
		type: 'number' as const,
		default: 300,
	},
	src: {
		type: 'string' as const,
		default: 'home',
		hidden: true,
	},
	antenna: {
		type: 'object' as const,
		default: null,
		hidden: true,
	},
	list: {
		type: 'object' as const,
		default: null,
		hidden: true,
	},
} satisfies Form;

type WidgetPropsFormResult = GetFormResultType<typeof widgetPropsDef>;
type KnownAntenna = Misskey.entities.Antenna & Record<string, unknown>;
type KnownUserList = Misskey.entities.UserList & Record<string, unknown>;
type WidgetProps = Omit<WidgetPropsFormResult, 'antenna' | 'list' | 'src'> & {
	src: AllTimelineType;
	antenna: KnownAntenna | null;
	list: KnownUserList | null;
};

const props = defineProps<WidgetComponentProps<WidgetPropsFormResult>>();
const emit = defineEmits<WidgetComponentEmits<WidgetPropsFormResult>>();

const manager = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit,
);

const widgetProps = manager.widgetProps as WidgetProps;
const { configure, save } = manager;

const menuOpened = ref(false);

const timelineKey = computed(() => {
	if (widgetProps.src === 'list') {
		return widgetProps.list ? `list:${widgetProps.list.id}` : 'list';
	}
	if (widgetProps.src === 'antenna') {
		return widgetProps.antenna ? `antenna:${widgetProps.antenna.id}` : 'antenna';
	}
	return widgetProps.src;
});

const listId = computed(() => widgetProps.list?.id ?? undefined);
const antennaId = computed(() => widgetProps.antenna?.id ?? undefined);

const selectedTimelineLabel = computed(() => {
	if (widgetProps.src === 'list') {
		return widgetProps.list?.name ?? i18n.ts.lists;
	}
	if (widgetProps.src === 'antenna') {
		return widgetProps.antenna?.name ?? i18n.ts.antennas;
	}
	return i18n.ts._timelines[widgetProps.src as BasicTimelineType];
});

const setSrc = (src: AllTimelineType) => {
	widgetProps.src = src;
	save();
};

const choose = async (ev: MouseEvent) => {
	menuOpened.value = true;
	const [antennas, lists] = await Promise.all([
		misskeyApi<Misskey.entities.Antenna[]>('antennas/list'),
		misskeyApi<Misskey.entities.UserList[]>('users/lists/list'),
	]);
	const antennaItems = antennas.map(antenna => ({
		text: antenna.name,
		icon: 'ti ti-antenna',
		action: () => {
			widgetProps.antenna = antenna as KnownAntenna;
			setSrc('antenna');
		},
	}));
	const listItems = lists.map(list => ({
		text: list.name,
		icon: 'ti ti-list',
		action: () => {
			widgetProps.list = list as KnownUserList;
			setSrc('list');
		},
	}));

	const menuItems: MenuItem[] = [];

	menuItems.push(...availableBasicTimelines().map(tl => ({
		text: i18n.ts._timelines[tl],
		icon: basicTimelineIconClass(tl),
		action: () => { setSrc(tl); },
	})));

	if (antennaItems.length > 0) {
		menuItems.push({ type: 'divider' });
		menuItems.push(...antennaItems);
	}

	if (listItems.length > 0) {
		menuItems.push({ type: 'divider' });
		menuItems.push(...listItems);
	}

	os.popupMenu(menuItems, ev.currentTarget ?? ev.target).then(() => {
		menuOpened.value = false;
	});
};

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.disabled {
	text-align: center;
}

.disabledTitle {
	margin: 16px;
}

.disabledDescription {
	font-size: 90%;
}
</style>
