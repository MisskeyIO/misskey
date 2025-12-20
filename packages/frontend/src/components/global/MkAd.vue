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
			@click="hideSensitive ? showHiddenSensitiveAd($event) : onAdClicked()"
		>
			<div :class="[$style.imgBox, (chosen.isSensitive && prefer.s.highlightSensitiveMedia) && $style.sensitive]">
				<ImgWithBlurhash
					:class="$style.img"
					:hash="chosen.imageBlurhash"
					:src="hideSensitive ? null : chosen.imageUrl"
					:forceBlurhash="hideSensitive"
					:cover="false"
					:width="adDimensions.width"
					:height="adDimensions.height"
					:style="hideSensitive ? 'filter: brightness(0.7);' : null"
				/>
				<template v-if="hideSensitive">
					<div :class="$style.hiddenText">
						<div :class="$style.hiddenTextWrapper">
							<b style="display: block;"><i class="ti ti-eye-exclamation"></i> {{ i18n.ts.sensitiveAd }}</b>
							<span style="display: block;">{{ i18n.ts.clickToShow }}</span>
						</div>
					</div>
				</template>
			</div>
			<button class="_button" :class="$style.i" @click.prevent.stop="toggleMenu"><i :class="$style.iIcon" class="ti ti-info-circle"></i></button>
		</component>
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
/* eslint-disable id-denylist */
import { ref, computed, onActivated, onMounted, watch } from 'vue';
import { url as local, host } from '@@/js/config.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import MkButton from '@/components/MkButton.vue';
import ImgWithBlurhash from '@/components/MkImgWithBlurhash.vue';
import { store } from '@/store.js';
import * as os from '@/os.js';
import { $i } from '@/i.js';
import { prefer } from '@/preferences.js';
import { usageReport } from '@/utility/usage-report.js';
import { sensitiveContentConsent, requestSensitiveContentConsent } from '@/utility/sensitive-content-consent.js';

type Ad = (typeof instance)['ads'][number];

const props = defineProps<{
	preferForms: string[];
	specify?: Ad;
}>();

const showMenu = ref(false);
const toggleMenu = (): void => {
	showMenu.value = !showMenu.value;
};

const excludeSensitive = computed(() => prefer.s.displayOfSensitiveAds === 'filtered' || sensitiveContentConsent.value === false);

const choseAd = (): Ad | null => {
	if (props.specify) {
		return props.specify;
	}

	const baseAds = (excludeSensitive.value ? instance.ads.filter(ad => !ad.isSensitive) : instance.ads);

	const allAds = baseAds.map(ad => store.s.mutedAds.includes(ad.id) ? {
		...ad,
		ratio: 0,
	} : ad);

	const valuableAds = allAds.filter(ad => ad.ratio !== 0);
	const lowPriorityAds = allAds.filter(ad => ad.ratio === 0);

	let ads: Ad[];
	const preferredAds = valuableAds.filter(ad => props.preferForms.includes(ad.place));
	if (preferredAds.length !== 0) {
		ads = preferredAds;
	} else {
		ads = lowPriorityAds.filter(ad => props.preferForms.includes(ad.place));
	}

	if (ads.length === 0) {
		const nonPreferredAds = valuableAds.filter(ad => !props.preferForms.includes(ad.place));
		if (nonPreferredAds.length !== 0) {
			ads = nonPreferredAds;
		} else {
			ads = lowPriorityAds.filter(ad => !props.preferForms.includes(ad.place));
		}
	}

	if (ads.length === 0) return null;

	const totalFactor = ads.reduce((a, b) => a + b.ratio, 0);
	if (totalFactor === 0) return ads[Math.floor(Math.random() * ads.length)];
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

const shouldHide = computed(() => {
	const hideByPolicy = !prefer.s.forceShowAds && $i && $i.policies.canHideAds && (props.specify == null);
	if (hideByPolicy) return true;

	const ad = chosen.value;
	if (!ad?.isSensitive) return false;
	if (prefer.s.displayOfSensitiveAds === 'filtered') return true;
	return sensitiveContentConsent.value === false;
});

const adDimensions = computed(() => {
	switch (chosen.value?.place) {
		case 'horizontal': return { width: 600, height: 80 };
		case 'horizontal-big': return { width: 600, height: 250 };
		case 'vertical': return { width: 300, height: 450 };
		case 'square':
		default: return { width: 300, height: 300 };
	}
});

function calcHideSensitive(): boolean {
	const ad = chosen.value;
	if (!ad?.isSensitive) return false;
	if (sensitiveContentConsent.value !== true) return true;
	return prefer.s.displayOfSensitiveAds !== 'always';
}

const hideSensitive = ref(calcHideSensitive());

watch(chosen, () => {
	hideSensitive.value = calcHideSensitive();
});

watch([() => prefer.s.displayOfSensitiveAds, () => sensitiveContentConsent.value], () => {
	hideSensitive.value = calcHideSensitive();
});

watch([excludeSensitive, chosen], () => {
	if (props.specify != null) return;
	if (excludeSensitive.value && chosen.value?.isSensitive) {
		chosen.value = choseAd();
		showMenu.value = false;
	}
}, { immediate: true });

function reduceFrequency(): void {
	if (chosen.value == null) return;
	if (store.s.mutedAds.includes(chosen.value.id)) return;
	store.push('mutedAds', chosen.value.id);
	os.success();
	chosen.value = choseAd();
	showMenu.value = false;
}

function onAdClicked(): void {
	if (chosen.value == null) return;
	usageReport({
		t: Math.floor(Date.now() / 1000),
		e: 'a',
		i: chosen.value.id,
		a: 'c',
	});
}

async function showHiddenSensitiveAd(ev: MouseEvent) {
	if (!hideSensitive.value) return;
	if (chosen.value == null || !chosen.value.isSensitive) return;

	ev.preventDefault();
	ev.stopPropagation();

	// `displayOfSensitiveAds` is the "master" switch; when filtered, don't allow revealing.
	if (prefer.s.displayOfSensitiveAds === 'filtered') return;

	if (sensitiveContentConsent.value !== true) {
		const allowed = await requestSensitiveContentConsent();
		if (!allowed) {
			if (props.specify == null) {
				chosen.value = choseAd();
				showMenu.value = false;
			}
			return;
		}
	}

	hideSensitive.value = false;
}

onMounted(() => {
	if (shouldHide.value || chosen.value == null) return;
	usageReport({
		t: Math.floor(Date.now() / 1000),
		e: 'a',
		i: chosen.value.id,
		a: 'v',
	});
});

onActivated(() => {
	if (shouldHide.value || chosen.value == null) return;
	usageReport({
		t: Math.floor(Date.now() / 1000),
		e: 'a',
		i: chosen.value.id,
		a: 'v',
	});
});
</script>

<style lang="scss" module>
.main {
	text-align: center;

	&.form_square {
		> .link { width: min(300px, 100%); }
		> .link > .imgBox { aspect-ratio: 1 / 1; }
	}

	&.form_horizontal {
		> .link { width: min(600px, 100%); }
		> .link > .imgBox { aspect-ratio: 600 / 80; }
	}

	&.form_horizontalBig {
		> .link { width: min(600px, 100%); }
		> .link > .imgBox { aspect-ratio: 600 / 250; }
	}

	&.form_vertical {
		> .link { width: min(300px, 100%); }
		> .link > .imgBox { aspect-ratio: 300 / 450; }
	}
}

.link {
	display: inline-block;
	position: relative;
	vertical-align: bottom;

	&:hover {
		.img {
			filter: contrast(120%);
		}
	}
}

.imgBox {
	position: relative;
	width: 100%;
}

.img {
	display: block;
	margin: auto;
	border-radius: 5px;
	overflow: hidden;
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
	z-index: 2;
}

.iIcon {
	font-size: 14px;
	line-height: 17px;
}

.hiddenText {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
	display: flex;
	justify-content: center;
	align-items: center;
	cursor: pointer;
}

.hiddenTextWrapper {
	display: table-cell;
	text-align: center;
	font-size: 0.8em;
	color: #fff;
}

.sensitive {
	position: relative;

	&::after {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		border-radius: 5px;
		box-shadow: inset 0 0 0 4px var(--MI_THEME-warn);
	}
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
