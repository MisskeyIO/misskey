<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkContainer :style="`height: ${widgetProps.height}px;`" :showHeader="widgetProps.showHeader" :scrollable="true" class="mkw-bdayfollowings">
	<template #icon><i class="ti ti-cake"></i></template>
	<template v-if="widgetProps.period === 'today'" #header>{{ i18n.ts._widgets.birthdayFollowings }}</template>
	<template v-else #header>{{ i18n.ts._widgets.birthdaySoon }}</template>
	<template #func="{ buttonStyleClass }"><button class="_button" :class="buttonStyleClass" @click="fetch(true)"><i class="ti ti-refresh"></i></button></template>

	<div :class="$style.bdayFRoot">
		<MkLoading v-if="fetching"/>
		<div v-else-if="followees.length > 0" :class="$style.bdayFGrid">
			<MkAvatar v-for="user in followees" :key="user.id" :user="user" link preview/>
		</div>
		<div v-else :class="$style.bdayFFallback">
			<MkResult type="empty"/>
		</div>
	</div>

</MkContainer>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import MkContainer from '@/components/MkContainer.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useInterval } from '@@/js/use-interval.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';

const name = 'birthdayFollowings';

const widgetPropsDef = {
	showHeader: {
		type: 'boolean',
		default: true,
	},
	height: {
		type: 'number',
		default: 300,
	},
	period: {
		type: 'radio',
		default: 'today',
		options: [{
			value: 'today' as const,
			label: 'Today',
		}, {
			value: '3day' as const,
			label: '3 days',
		}, {
			value: 'week' as const,
			label: 'Week',
		}, {
			value: 'month' as const,
			label: 'Month',
		}],
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure } = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit,
);

const fetching = ref(false);
const users = ref<any[]>([]);

const followees = computed(() => users.value.map((u: any) => u.followee ?? u.user ?? u).filter((u: any) => u != null));

const lastFetchKey = ref<string>('');

async function fetch(force = false) {
	if ($i == null) {
		users.value = [];
		return;
	}

	const now = new Date();
	const key = `${now.toDateString()}:${widgetProps.period}`;
	if (!force && lastFetchKey.value === key) return;
	lastFetchKey.value = key;

	const begin = now;
	const end = new Date(begin.getTime() + 1000 * 60 * 60 * 24 * (
		widgetProps.period === '3day' ? 3 :
		widgetProps.period === 'week' ? 7 :
		widgetProps.period === 'month' ? 30 :
		0
	));

	const birthday = widgetProps.period === 'today'
		? { month: begin.getMonth() + 1, day: begin.getDate() }
		: {
			begin: { month: begin.getMonth() + 1, day: begin.getDate() },
			end: { month: end.getMonth() + 1, day: end.getDate() },
		};

	fetching.value = true;
	try {
		users.value = await misskeyApi('users/get-following-birthday-users', {
			limit: 18,
			birthday,
		});
	} finally {
		fetching.value = false;
	}
}

watch(() => widgetProps.period, () => {
	fetch(true);
});

useInterval(() => fetch(false), 1000 * 60, {
	immediate: true,
	afterMounted: true,
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.bdayFRoot {
	overflow: hidden;
	min-height: calc(calc(calc(50px * 3) - 8px) + calc(var(--MI-margin) * 2));
}
.bdayFGrid {
	display: grid;
	grid-template-columns: repeat(6, 42px);
	grid-template-rows: repeat(3, 42px);
	place-content: center;
	gap: 8px;
	margin: var(--MI-margin) auto;
}

.bdayFFallback {
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
}

</style>
