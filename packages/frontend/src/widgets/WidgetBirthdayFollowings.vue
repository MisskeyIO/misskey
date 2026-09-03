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

	<MkLoading v-if="fetching && users.length === 0"/>
	<div v-else-if="users.length > 0" :class="$style.list">
		<div v-for="item in users" :key="item.user.id" :class="$style.row">
			<time :datetime="item.birthday" :class="$style.birthday">{{ birthdayLabel(item.birthday) }}</time>
			<MkA :to="userPage(item.user)" style="overflow: hidden;">
				<MkUserCardMini :user="item.user" :withChart="false" style="text-overflow: ellipsis; background: inherit; border-radius: unset;"/>
			</MkA>
			<button v-tooltip.noDelay="i18n.ts.note" class="_button" :class="$style.post" @click="os.post({ initialText: `@${item.user.username}${item.user.host ? `@${item.user.host}` : ''} ` })">
				<i class="ti-fw ti ti-confetti" :class="$style.postIcon"></i>
			</button>
		</div>
		<MkButton v-if="hasMore" :class="$style.more" :disabled="fetching" @click="actualFetch()">{{ i18n.ts.loadMore }}</MkButton>
	</div>
	<div v-else :class="$style.empty" :style="`height: ${widgetProps.showHeader ? widgetProps.height - 38 : widgetProps.height}px;`">
		<img :src="infoImageUrl" class="_ghost"/>
		<div>{{ i18n.ts.nothing }}</div>
	</div>
</MkContainer>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import * as Misskey from 'misskey-js';
import { useInterval } from '@@/js/use-interval.js';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import MkContainer from '@/components/MkContainer.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import MkButton from '@/components/MkButton.vue';
import MkUserCardMini from '@/components/MkUserCardMini.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { userPage } from '@/filters/user.js';
import { infoImageUrl } from '@/instance.js';

const name = i18n.ts._widgets.birthdaySoon;

const widgetPropsDef = {
	showHeader: {
		type: 'boolean',
		label: i18n.ts._widgetOptions.showHeader,
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
			value: 'today', label: i18n.ts.today,
		}, {
			value: '3day', label: i18n.tsx.dayX({ day: 3 }),
		}, {
			value: 'week', label: i18n.ts.oneWeek,
		}, {
			value: 'month', label: i18n.ts.oneMonth,
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

const begin = ref<Date>(new Date());
const end = computed(() => {
	switch (widgetProps.period) {
		case '3day':
			return new Date(begin.value.getTime() + 1000 * 60 * 60 * 24 * 3);
		case 'week':
			return new Date(begin.value.getTime() + 1000 * 60 * 60 * 24 * 7);
		case 'month':
			return new Date(begin.value.getTime() + 1000 * 60 * 60 * 24 * 30);
		default:
			return begin.value;
	}
});

type BirthdayUser = Misskey.Endpoints['users/get-following-birthday-users']['res'][number];

const users = ref<BirthdayUser[]>([]);
const fetching = ref(false);
const hasMore = ref(false);
let lastFetchedDay = '';

function birthdayParam() {
	if (widgetProps.period === 'today') {
		return {
			month: begin.value.getMonth() + 1,
			day: begin.value.getDate(),
		};
	}
});

	return {
		begin: {
			month: begin.value.getMonth() + 1,
			day: begin.value.getDate(),
		},
		end: {
			month: end.value.getMonth() + 1,
			day: end.value.getDate(),
		},
	};
}

async function actualFetch(reset = false) {
	if (fetching.value) return;
	if (reset) {
		begin.value = new Date();
		users.value = [];
	}

	fetching.value = true;
	try {
		const result = await misskeyApi('users/get-following-birthday-users', {
			limit: 18,
			offset: users.value.length,
			birthday: birthdayParam(),
		});
		users.value.push(...result);
		hasMore.value = result.length === 18;
		lastFetchedDay = begin.value.toDateString();
	} finally {
		fetching.value = false;
	}
}

function fetch(force = false) {
	const today = new Date().toDateString();
	if (force || today !== lastFetchedDay) void actualFetch(true);
}

function birthdayLabel(birthday: string) {
	const date = new Date(birthday);
	return `${date.getMonth() + 1}/${date.getDate()}`;
}

watch(() => widgetProps.period, () => fetch(true));

useInterval(fetch, 1000 * 60, {
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
.list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 8px;
}

.row {
	display: grid;
	grid-template-columns: 48px minmax(0, 1fr) 48px;
	align-items: center;
	gap: 8px;
}

.birthday {
	text-align: center;
	font-size: 0.85em;
}

.more {
	margin: 8px auto;
}

.empty {
	display: flex;
	font-size: 85%;
	align-items: center;

	> img {
		height: 96px;
		width: auto;
		max-width: 90%;
		margin-bottom: 8px;
		border-radius: var(--MI-radius);
	}
}

.post {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 40px;
	margin: auto;
	aspect-ratio: 1/1;
	border-radius: 100%;
	background: linear-gradient(90deg, var(--MI_THEME-buttonGradateA), var(--MI_THEME-buttonGradateB));

	&:hover, &.active {
		&:before {
			background: hsl(from var(--MI_THEME-accent) h s calc(l + 10));
		}
	}
}

.postIcon {
	color: var(--MI_THEME-fgOnAccent);
}
</style>
