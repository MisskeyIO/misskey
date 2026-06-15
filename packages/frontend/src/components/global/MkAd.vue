<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="chosen && !shouldHide">
	<div
		v-if="!showMenu"
		:class="[$style.main, {
			[$style.form_square]: chosen.place === 'square',
			[$style.form_horizontal]: chosen.place === 'horizontal',
			[$style.form_horizontalBig]: chosen.place === 'horizontal-big',
			[$style.form_vertical]: chosen.place === 'vertical',
		}]"
	>
		<template v-if="!hidesSensitiveAd">
			<component
				:is="self ? 'MkA' : 'a'"
				:class="$style.link"
				v-bind="self ? {
					to: chosen.url.substring(local.length),
				} : {
					href: chosen.url,
					rel: 'nofollow noopener',
					target: '_blank',
				}"
			>
				<img :src="chosen.imageUrl" :class="$style.img">
				<button class="_button" :class="$style.i" @click.prevent.stop="toggleMenu"><i :class="$style.iIcon" class="ti ti-info-circle"></i></button>
			</component>
		</template>
		<div
			v-else
			:class="$style.sensitiveHidden"
			:role="canRevealSensitiveAd ? 'button' : undefined"
			:tabindex="canRevealSensitiveAd ? 0 : undefined"
			@click="showSensitiveAd"
			@keydown.enter="showSensitiveAd"
			@keydown.space.prevent="showSensitiveAd"
		>
			<b><i class="ti ti-eye-exclamation" :class="$style.sensitiveIcon"></i> {{ i18n.ts.sensitive }}</b>
			<span v-if="canRevealSensitiveAd">{{ i18n.ts.clickToShow }}</span>
			<button class="_button" :class="$style.i" @click.prevent.stop="toggleMenu"><i :class="$style.iIcon" class="ti ti-info-circle"></i></button>
		</div>
	</div>
	<div v-else :class="$style.menu">
		<div>Ads by {{ host }}</div>
		<!--<MkButton class="button" primary>{{ i18n.ts._ad.like }}</MkButton>-->
		<MkButton v-if="chosen.ratio !== 0" :class="$style.menuButton" @click="reduceFrequency">{{ i18n.ts._ad.reduceFrequencyOfThisAd }}</MkButton>
		<button class="_textButton" @click="toggleMenu">{{ i18n.ts._ad.back }}</button>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { url as local, host } from '@@/js/config.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import MkButton from '@/components/MkButton.vue';
import { store } from '@/store.js';
import * as os from '@/os.js';
import { $i } from '@/i.js';
import { prefer } from '@/preferences.js';
import { sensitiveContentConsent, requestSensitiveContentConsent } from '@/utility/sensitive-content-consent.js';

type Ad = (typeof instance)['ads'][number];

const props = defineProps<{
	preferForms?: string[];
	specify?: Ad;
}>();

const showMenu = ref(false);
const toggleMenu = (): void => {
	showMenu.value = !showMenu.value;
};

function shouldFilterSensitiveAd(ad: Ad): boolean {
	return ad.isSensitive === true && (prefer.s.displayOfSensitiveAds === 'filtered' || sensitiveContentConsent.value === false);
}

const choseAd = (): Ad | null => {
	if (props.specify) {
		return props.specify;
	}

	const allAds = instance.ads.map(ad => store.s.mutedAds.includes(ad.id) ? {
		...ad,
		ratio: 0,
	} : ad).filter(ad => !shouldFilterSensitiveAd(ad));

	let ads = props.preferForms ? allAds.filter(ad => props.preferForms!.includes(ad.place)) : allAds;

	if (ads.length === 0) {
		ads = allAds.filter(ad => ad.place === 'square');
	}

	const lowPriorityAds = ads.filter(ad => ad.ratio === 0);
	ads = ads.filter(ad => ad.ratio !== 0);

	if (ads.length === 0) {
		if (lowPriorityAds.length !== 0) {
			return lowPriorityAds[Math.floor(Math.random() * lowPriorityAds.length)];
		} else {
			return null;
		}
	}

	const totalFactor = ads.reduce((a, b) => a + b.ratio, 0);
	const r = Math.random() * totalFactor;

	let stackedFactor = 0;
	for (const ad of ads) {
		if (r >= stackedFactor && r <= stackedFactor + ad.ratio) {
			return ad;
		} else {
			stackedFactor += ad.ratio;
		}
	}

	return null;
};

const chosen = ref(choseAd());

const self = computed(() => chosen.value?.url.startsWith(local));

const shouldHide = ref(!prefer.s.forceShowAds && $i && $i.policies.canHideAds && (props.specify == null));
const sensitiveAdRevealed = ref(false);

const canRevealSensitiveAd = computed(() => chosen.value?.isSensitive === true && prefer.s.displayOfSensitiveAds === 'hidden' && sensitiveContentConsent.value !== false);
const hidesSensitiveAd = computed(() => {
	if (chosen.value?.isSensitive !== true) return false;
	if (sensitiveContentConsent.value === false) return true;
	if (prefer.s.displayOfSensitiveAds === 'always') return false;
	if (prefer.s.displayOfSensitiveAds === 'hidden') return !sensitiveAdRevealed.value;
	return true;
});

async function showSensitiveAd(ev: MouseEvent | KeyboardEvent): Promise<void> {
	if (!canRevealSensitiveAd.value) return;

	ev.preventDefault();
	ev.stopPropagation();

	const allowed = await requestSensitiveContentConsent();
	if (!allowed) return;

	sensitiveAdRevealed.value = true;
}

function reduceFrequency(): void {
	if (chosen.value == null) return;
	if (store.s.mutedAds.includes(chosen.value.id)) return;
	store.push('mutedAds', chosen.value.id);
	os.success();
	chosen.value = choseAd();
	sensitiveAdRevealed.value = false;
	showMenu.value = false;
}
</script>

<style lang="scss" module>
.main {
	text-align: center;

	&.form_square {
		> .link,
		> .sensitiveHidden,
		> .link > .img {
			max-width: min(300px, 100%);
			max-height: 300px;
		}
	}

	&.form_horizontal {
		> .link,
		> .sensitiveHidden,
		> .link > .img {
			max-width: min(600px, 100%);
			max-height: 80px;
		}
	}

	&.form_horizontalBig {
		> .link,
		> .sensitiveHidden,
		> .link > .img {
			max-width: min(600px, 100%);
			max-height: 250px;
		}
	}

	&.form_vertical {
		> .link,
		> .sensitiveHidden,
		> .link > .img {
			max-width: min(100px, 100%);
		}

		> .sensitiveHidden {
			min-height: 100px;
		}
	}
}

.link {
	display: inline-block;
	position: relative;
	vertical-align: bottom;

	&:hover {
		> .img {
			filter: contrast(120%);
		}
	}
}

.img {
	display: block;
	object-fit: contain;
	margin: auto;
	border-radius: 5px;
}

.sensitiveHidden {
	box-sizing: border-box;
	display: inline-flex;
	position: relative;
	align-items: center;
	justify-content: center;
	flex-direction: column;
	gap: 4px;
	padding: 16px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 5px;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
	font-size: 0.8em;
	overflow: hidden;
	vertical-align: bottom;

	&[role='button'] {
		cursor: pointer;
	}
}

.sensitiveIcon {
	color: var(--MI_THEME-warn);
}

.i {
	position: absolute;
	top: 1px;
	right: 1px;
	display: grid;
	place-content: center;
	background: var(--MI_THEME-panel);
	border-radius: 100%;
	padding: 2px;
}

.iIcon {
	font-size: 14px;
	line-height: 17px;
}

.menu {
	text-align: center;
	padding: 8px;
	margin: 0 auto;
	max-width: 400px;
	background: var(--MI_THEME-panel);
	border: solid 1px var(--MI_THEME-divider);
}

.menuButton {
	margin: 8px auto;
}
</style>
