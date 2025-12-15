<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal
	ref="modal"
	:preferType="'dialog'"
	:zPriority="'middle'"
	hasInteractionWithOtherFocusTrappedEls
	@closed="emit('closed')"
>
	<div class="_panel _shadow" :class="$style.root">
		<div :class="$style.main">
			<div style="display: flex; align-items: center;">
				<div :class="$style.headerIcon">
					<i class="ti ti-rating-18-plus"></i>
				</div>
				<div :class="$style.headerTitle">{{ i18n.ts.sensitiveContentConsentTitle }}</div>
			</div>
			<div :class="$style.text">
				{{ i18n.ts.sensitiveContentConsentAreYouOver18 }}
			</div>
			<div class="_gaps_s">
				<div class="_buttons" style="justify-content: right;">
					<MkButton @click="deny">{{ i18n.ts.no }}</MkButton>
					<MkButton primary @click="accept">{{ i18n.ts.yes }}</MkButton>
				</div>
				<MkFolder :defaultOpen="true">
					<template #icon><i class="ti ti-settings"></i></template>
					<template #label>{{ i18n.ts.displayedContentSettings }}</template>
					<div class="_gaps_s">
						<MkSelect v-model="nsfw">
							<template #label>{{ i18n.ts.displayOfSensitiveMedia }}</template>
							<option value="respect">{{ i18n.ts._displayOfSensitiveMedia.respect }}</option>
							<option value="ignore">{{ i18n.ts._displayOfSensitiveMedia.ignore }}</option>
							<option value="force">{{ i18n.ts._displayOfSensitiveMedia.force }}</option>
						</MkSelect>
						<MkSwitch v-model="confirmWhenRevealingSensitiveMedia">
							{{ i18n.ts.confirmWhenRevealingSensitiveMedia }}
						</MkSwitch>
						<MkSwitch v-model="highlightSensitiveMedia">
							{{ i18n.ts.highlightSensitiveMedia }}
						</MkSwitch>
						<MkSwitch v-model="showSensitiveAds">
							{{ i18n.ts.showSensitiveAds }}
							<template #caption>{{ i18n.ts.showSensitiveAdsDescription }}</template>
						</MkSwitch>
						<MkSwitch v-model="alwaysShowSensitiveAds" :disabled="!showSensitiveAds">
							{{ i18n.ts.alwaysShowSensitiveAds }}
						</MkSwitch>
					</div>
				</MkFolder>
			</div>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef, watch } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkModal from '@/components/MkModal.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { usageReport } from '@/utility/usage-report.js';
import { setSensitiveContentConsent } from '@/utility/sensitive-content-consent.js';

const props = defineProps<{
	trigger: 'media' | 'ad';
}>();

const emit = defineEmits<{
	(ev: 'decided', allowed: boolean): void;
	(ev: 'closed'): void;
}>();

const modal = useTemplateRef('modal');

const showSensitiveAds = ref(true);
const alwaysShowSensitiveAds = ref(!!prefer.s.alwaysShowSensitiveAds);

const nsfw = prefer.model('nsfw');
const confirmWhenRevealingSensitiveMedia = prefer.model('confirmWhenRevealingSensitiveMedia');
const highlightSensitiveMedia = prefer.model('highlightSensitiveMedia');

watch(showSensitiveAds, (v) => {
	if (!v) {
		alwaysShowSensitiveAds.value = false;
	}
});

watch(alwaysShowSensitiveAds, (v) => {
	if (v) {
		showSensitiveAds.value = true;
	}
});

function commitAdPrefs() {
	prefer.commit('showSensitiveAds', !!showSensitiveAds.value);
	prefer.commit('alwaysShowSensitiveAds', !!alwaysShowSensitiveAds.value);
}

function accept() {
	setSensitiveContentConsent(true);
	commitAdPrefs();
	usageReport({
		t: Math.floor(Date.now() / 1000),
		e: 'p',
		i: 'showSensitiveAds',
		a: showSensitiveAds.value ? '1' : '0',
	});
	usageReport({
		t: Math.floor(Date.now() / 1000),
		e: 'p',
		i: 'alwaysShowSensitiveAds',
		a: alwaysShowSensitiveAds.value ? '1' : '0',
	});

	emit('decided', true);
	if (modal.value) modal.value.close();
}

function deny() {
	setSensitiveContentConsent(false);
	prefer.commit('showSensitiveAds', false);
	prefer.commit('alwaysShowSensitiveAds', false);
	usageReport({
		t: Math.floor(Date.now() / 1000),
		e: 'p',
		i: 'showSensitiveAds',
		a: '0',
	});
	usageReport({
		t: Math.floor(Date.now() / 1000),
		e: 'p',
		i: 'alwaysShowSensitiveAds',
		a: '0',
	});

	emit('decided', false);
	if (modal.value) modal.value.close();
}
</script>

<style lang="scss" module>
.root {
	margin: auto;
	box-sizing: border-box;
	width: 100%;
	max-width: 560px;
	height: 100%;
	max-height: 600px;
	overflow: auto;
}

.main {
	padding: 25px;
}

.headerIcon {
	margin-right: 10px;
	font-size: 40px;
	color: var(--MI_THEME-warn);
}

.headerTitle {
	font-weight: bold;
	font-size: 16px;
}

.text {
	margin: 0.7em 0 1em 0;
}
</style>
