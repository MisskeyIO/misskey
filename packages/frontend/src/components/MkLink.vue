<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<component
	:is="self ? 'MkA' : 'a'"
	ref="el"
	style="word-break: break-all;"
	class="_link"
	:[attr]="maybeRelativeUrl"
	:rel="rel ?? 'nofollow noopener'"
	:target="target"
	:behavior="props.navigationBehavior"
	:title="url"
	@click="(ev: MouseEvent) => warningExternalWebsite(ev, url)"
>
	<slot></slot>
	<i v-if="target === '_blank' && !hideIcon" class="ti ti-external-link" :class="$style.icon"></i>
</component>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref } from 'vue';
import { url as local } from '@/config.js';
import { useTooltip } from '@/scripts/use-tooltip.js';
import { warningExternalWebsite } from '@/scripts/warning-external-website.js';
import * as os from '@/os.js';
import { isEnabledUrlPreview } from '@/instance.js';
import type { MkABehavior } from '@/components/global/MkA.vue';
import { maybeMakeRelative } from '@/scripts/url.js';

const props = withDefaults(defineProps<{
	url: string;
	rel?: null | string;
	navigationBehavior?: MkABehavior;
	hideIcon?: boolean;
}>(), {
	hideIcon: false,
});

const maybeRelativeUrl = maybeMakeRelative(props.url, local);
const self = maybeRelativeUrl !== props.url;
const attr = self ? 'to' : 'href';
const target = self ? null : '_blank';

const el = ref<HTMLElement | { $el: HTMLElement }>();

if (isEnabledUrlPreview.value) {
	useTooltip(el, (showing) => {
		os.popup(defineAsyncComponent(() => import('@/components/MkUrlPreviewPopup.vue')), {
			showing,
			url: props.url,
			source: el.value instanceof HTMLElement ? el.value : el.value?.$el,
		}, {}, 'closed');
	});
}
</script>

<style lang="scss" module>
.icon {
	padding-left: 2px;
	font-size: .9em;
}
</style>
