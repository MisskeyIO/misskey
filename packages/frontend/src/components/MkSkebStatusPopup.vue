<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" :style="{ zIndex, top: top + 'px', left: left + 'px' }">
	<Transition :name="prefer.s.animation ? '_transition_zoom' : ''" appear @afterLeave="emit('closed')">
		<div v-if="showing" class="_popup _shadow" :class="$style.popup">
			<button class="_button" :class="$style.close" :aria-label="i18n.ts.close" @click="emit('closed')"><i class="ti ti-x"></i></button>
			<MkLoading v-if="loading"/>
			<div v-else-if="status != null" class="_gaps_s">
				<header :class="$style.header">
					<strong>Skeb</strong>
					<span v-if="status.isAcceptable" :class="$style.acceptable">{{ skebStatusI18n.seeking }}</span>
					<span v-else-if="status.isCreator" :class="$style.stopped">{{ skebStatusI18n.stopped }}</span>
					<span v-else :class="$style.client">{{ skebStatusI18n.client }}</span>
				</header>
				<div class="_gaps_s">
					<div v-if="status.creatorRequestCount > 0">{{ skebStatusI18nX.nWorks({ n: status.creatorRequestCount.toLocaleString() }) }}</div>
					<div v-else-if="status.clientRequestCount > 0">{{ skebStatusI18nX.nRequests({ n: status.clientRequestCount.toLocaleString() }) }}</div>
					<div v-if="status.isAcceptable && status.skills.length > 0" :class="$style.skills">
						<div v-for="skill in status.skills" :key="skill.genre">
							{{ skebStatusI18n._genres[skill.genre] }} {{ skebStatusI18nX.yenX({ x: skill.amount.toLocaleString() }) }}
						</div>
					</div>
				</div>
				<div class="_buttons">
					<MkButton type="a" :href="`https://skeb.jp/@${status.screenName}`" target="_blank" rel="noopener noreferrer" primary><i class="ti ti-external-link"></i> {{ i18n.ts.openInNewTab }}</MkButton>
				</div>
			</div>
			<MkInfo v-else warn>{{ errorMessage ?? skebStatusI18n.unavailable }}</MkInfo>
		</div>
	</Transition>
</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';

export type SkebStatus = {
	screenName: string;
	isCreator: boolean;
	isAcceptable: boolean;
	creatorRequestCount: number;
	clientRequestCount: number;
	skills: {
		amount: number;
		genre: 'art' | 'comic' | 'voice' | 'novel' | 'video' | 'music' | 'correction';
	}[];
};

type SkebGenre = SkebStatus['skills'][number]['genre'];

type SkebStatusLocale = {
	seeking: string;
	stopped: string;
	client: string;
	unavailable: string;
	_genres: Record<SkebGenre, string>;
};

type SkebStatusLocaleX = {
	nWorks: (args: { n: string }) => string;
	nRequests: (args: { n: string }) => string;
	yenX: (args: { x: string }) => string;
};

const props = defineProps<{
	showing: boolean;
	loading: boolean;
	status: SkebStatus | null;
	errorMessage: string | null;
	source: HTMLElement;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const zIndex = os.claimZIndex('middle');
const top = ref(0);
const left = ref(0);
const skebStatusI18n = (i18n.ts as typeof i18n.ts & { _skebStatus: SkebStatusLocale })._skebStatus;
const skebStatusI18nX = (i18n.tsx as typeof i18n.tsx & { _skebStatus: SkebStatusLocaleX })._skebStatus;

onMounted(() => {
	const rect = props.source.getBoundingClientRect();
	left.value = Math.max((rect.left + (props.source.offsetWidth / 2)) - (280 / 2), 6) + window.scrollX;
	top.value = rect.top + props.source.offsetHeight + window.scrollY;
});
</script>

<style lang="scss" module>
.root {
	position: absolute;
	width: 280px;
	max-width: calc(90vw - 12px);
}

.popup {
	position: relative;
	padding: 16px;
	box-sizing: border-box;
}

.close {
	position: absolute;
	top: 8px;
	right: 8px;
	width: 28px;
	height: 28px;
	border-radius: 999px;
	color: var(--MI_THEME-fg);
	opacity: 0.7;

	&:hover, &:focus {
		opacity: 1;
		background: var(--MI_THEME-buttonBg);
	}
}

.header {
	display: flex;
	align-items: center;
	gap: 8px;
}

.acceptable,
.stopped,
.client {
	display: inline-flex;
	border-radius: 999px;
	padding: 2px 8px;
	font-size: 85%;
	color: var(--MI_THEME-fgOnAccent);
}

.acceptable {
	background: var(--MI_THEME-accent);
}

.stopped,
.client {
	background: var(--MI_THEME-fgTransparentWeak);
}

.skills {
	padding-top: 8px;
	border-top: solid 0.5px var(--MI_THEME-divider);
}
</style>
