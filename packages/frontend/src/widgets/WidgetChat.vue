<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkContainer :showHeader="showHeader" class="mkw-chat">
	<template #icon><i class="ti ti-mail"></i></template>
	<template #header>{{ i18n.ts.directMessage }}</template>

	<MkNotesTimeline :paginator="paginator"/>
</MkContainer>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import type { WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import MkContainer from '@/components/MkContainer.vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';

const name = 'chat';

const widgetPropsDef = {
	showHeader: {
		type: 'boolean',
		label: i18n.ts._widgetOptions.showHeader,
		default: true,
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const showHeader = computed(() => props.widget?.data.showHeader ?? widgetPropsDef.showHeader.default);

const paginator = markRaw(new Paginator('notes/mentions', {
	limit: 10,
	params: {
		visibility: 'specified',
	},
}));

defineExpose<WidgetComponentExpose>({
	name,
	configure: () => undefined,
	id: props.widget ? props.widget.id : null,
});
</script>
