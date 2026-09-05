<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/privacy" :label="i18n.ts.privacy" :keywords="['privacy']" icon="ti ti-lock-open">
	<div class="_gaps_m">
		<MkFeatureBanner icon="/fluent-emoji/1f513.png" color="#aeff00">
			<SearchText>{{ i18n.ts._settings.privacyBanner }}</SearchText>
		</MkFeatureBanner>

		<SearchMarker :keywords="['follow', 'lock']">
			<MkSwitch v-model="isLocked" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.makeFollowManuallyApprove }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.lockedAccountInfo }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<MkDisableSection :disabled="!isLocked">
			<SearchMarker :keywords="['follow', 'auto', 'accept']">
				<MkSwitch v-model="autoAcceptFollowed" @update:modelValue="save()">
					<template #label><SearchLabel>{{ i18n.ts.autoAcceptFollowed }}</SearchLabel></template>
				</MkSwitch>
			</SearchMarker>
		</MkDisableSection>

		<SearchMarker :keywords="['reaction', 'public']">
			<MkSwitch v-model="publicReactions" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.makeReactionsPublic }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.makeReactionsPublicDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['following', 'visibility']">
			<MkSelect v-model="followingVisibility" :items="followingVisibilityDef" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.followingVisibility }}</SearchLabel></template>
			</MkSelect>
		</SearchMarker>

		<SearchMarker :keywords="['follower', 'visibility']">
			<MkSelect v-model="followersVisibility" :items="followersVisibilityDef" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.followersVisibility }}</SearchLabel></template>
			</MkSelect>
		</SearchMarker>

		<SearchMarker :keywords="['online', 'status']">
			<MkSwitch v-model="hideOnlineStatus" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.hideOnlineStatus }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.hideOnlineStatusDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['crawle', 'index', 'search']">
			<MkSwitch v-model="noCrawle" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.noCrawle }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.noCrawleDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['crawle', 'ai']">
			<MkSwitch v-model="preventAiLearning" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.preventAiLearning }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.preventAiLearningDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['explore']">
			<MkSwitch v-model="isExplorable" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.makeExplorable }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.makeExplorableDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>
		<SearchMarker :label="i18n.ts.gtagConsentCustomize" :keywords="['analytics', 'privacy']">
			<FormSection v-if="instance.googleAnalyticsId">
				<MkFolder :defaultOpen="true">
					<template #icon><i class="ti ti-lock-square"></i></template>
					<template #label>{{ i18n.ts.gtagConsentCustomize }}</template>
					<div class="_gaps_s">
						<MkInfo>{{ i18n.tsx.gtagConsentCustomizeDescription({ host: instance.name ?? host }) }}</MkInfo>
						<MkSwitch v-model="gtagConsentAnalytics">
							{{ i18n.ts.gtagConsentAnalytics }}
							<template #caption>{{ i18n.ts.gtagConsentAnalyticsDescription }}</template>
						</MkSwitch>
						<MkSwitch v-model="gtagConsentFunctionality">
							{{ i18n.ts.gtagConsentFunctionality }}
							<template #caption>{{ i18n.ts.gtagConsentFunctionalityDescription }}</template>
						</MkSwitch>
						<MkSwitch v-model="gtagConsentPersonalization">
							{{ i18n.ts.gtagConsentPersonalization }}
							<template #caption>{{ i18n.ts.gtagConsentPersonalizationDescription }}</template>
						</MkSwitch>
					</div>
				</MkFolder>
			</FormSection>
		</SearchMarker>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { consent as gtagConsent } from 'vue-gtag';
import { host } from '@@/js/config.js';
import type { GtagConsentParams } from '@/types/gtag.js';
import FormSection from '@/components/form/section.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkFolder from '@/components/MkFolder.vue';
import { useMkSelect } from '@/composables/use-mkselect.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { ensureSignin } from '@/i.js';
import { definePage } from '@/page.js';
import * as os from '@/os.js';
import { miLocalStorage } from '@/local-storage.js';
import { unisonReload } from '@/utility/unison-reload.js';
import MkDisableSection from '@/components/MkDisableSection.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkFeatureBanner from '@/components/MkFeatureBanner.vue';

const $i = ensureSignin();

const isLocked = ref($i.isLocked);
const autoAcceptFollowed = ref($i.autoAcceptFollowed);
const noCrawle = ref($i.noCrawle);
const preventAiLearning = ref($i.preventAiLearning);
const isExplorable = ref($i.isExplorable);
const requireSigninToViewContents = ref($i.requireSigninToViewContents ?? false);
const makeNotesFollowersOnlyBefore = ref($i.makeNotesFollowersOnlyBefore ?? null);
const makeNotesHiddenBefore = ref($i.makeNotesHiddenBefore ?? null);
const hideOnlineStatus = ref($i.hideOnlineStatus);
const publicReactions = ref($i.publicReactions);
const {
	model: followingVisibility,
	def: followingVisibilityDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.public, value: 'public' },
		{ label: i18n.ts.followers, value: 'followers' },
		{ label: i18n.ts.private, value: 'private' },
	],
	initialValue: $i.followingVisibility,
});
const {
	model: followersVisibility,
	def: followersVisibilityDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.public, value: 'public' },
		{ label: i18n.ts.followers, value: 'followers' },
		{ label: i18n.ts.private, value: 'private' },
	],
	initialValue: $i.followersVisibility,
});
const chatScope = ref($i.chatScope);

const makeNotesFollowersOnlyBefore_type = computed(() => {
	if (makeNotesFollowersOnlyBefore.value == null) {
		return null;
	} else if (makeNotesFollowersOnlyBefore.value >= 0) {
		return 'absolute';
	} else {
		return 'relative';
	}
});

const makeNotesHiddenBefore_type = computed(() => {
	if (makeNotesHiddenBefore.value == null) {
		return null;
	} else if (makeNotesHiddenBefore.value >= 0) {
		return 'absolute';
	} else {
		return 'relative';
	}
});

const gaConsentInternal = ref(miLocalStorage.getItem('gaConsent') === 'true');
const gaConsent = computed({
	get: () => gaConsentInternal.value,
	set: (value: boolean) => {
		miLocalStorage.setItem('gaConsent', value ? 'true' : 'false');
		gaConsentInternal.value = value;
	},
});
const gtagConsentInternal = ref<GtagConsentParams>({
	ad_storage: 'denied',
	ad_user_data: 'denied',
	ad_personalization: 'denied',
	analytics_storage: 'denied',
	functionality_storage: 'denied',
	personalization_storage: 'denied',
	security_storage: 'granted',
	...(miLocalStorage.getItemAsJson('gtagConsent') as GtagConsentParams),
});
const gtagConsentParams = computed({
	get: () => gtagConsentInternal.value,
	set: (value: GtagConsentParams) => {
		miLocalStorage.setItemAsJson('gtagConsent', value);
		gtagConsentInternal.value = value;
	},
});
const gtagConsentAnalytics = computed({
	get: () => gtagConsentParams.value.analytics_storage === 'granted',
	set: (value: boolean) => {
		gtagConsentParams.value = {
			...gtagConsentParams.value,
			ad_storage: value ? 'granted' : 'denied',
			ad_user_data: value ? 'granted' : 'denied',
			analytics_storage: value ? 'granted' : 'denied',
		};
	},
});
const gtagConsentFunctionality = computed({
	get: () => gtagConsentParams.value.functionality_storage === 'granted',
	set: (value: boolean) => {
		gtagConsentParams.value = {
			...gtagConsentParams.value,
			functionality_storage: value ? 'granted' : 'denied',
		};
	},
});
const gtagConsentPersonalization = computed({
	get: () => gtagConsentParams.value.personalization_storage === 'granted',
	set: (value: boolean) => {
		gtagConsentParams.value = {
			...gtagConsentParams.value,
			ad_personalization: value ? 'granted' : 'denied',
			personalization_storage: value ? 'granted' : 'denied',
		};
	},
});

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: 'info',
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

watch(gaConsent, async () => {
	await reloadAsk();
});

watch(gtagConsentParams, async () => {
	gtagConsent('update', gtagConsentParams.value as GtagConsentParams);
});

watch([makeNotesFollowersOnlyBefore, makeNotesHiddenBefore], () => {
	save();
});

async function update_requireSigninToViewContents(value: boolean) {
	if (value === true && instance.federation !== 'none') {
		const { canceled } = await os.confirm({
			type: 'warning',
			text: i18n.ts.acknowledgeNotesAndEnable,
		});
		if (canceled) return;
	}

	requireSigninToViewContents.value = value;
	save();
}

function save() {
	misskeyApi('i/update', {
		isLocked: !!isLocked.value,
		autoAcceptFollowed: !!autoAcceptFollowed.value,
		noCrawle: !!noCrawle.value,
		preventAiLearning: !!preventAiLearning.value,
		isExplorable: !!isExplorable.value,
		// requireSigninToViewContents: !!requireSigninToViewContents.value,
		// makeNotesFollowersOnlyBefore: makeNotesFollowersOnlyBefore.value,
		// makeNotesHiddenBefore: makeNotesHiddenBefore.value,
		hideOnlineStatus: !!hideOnlineStatus.value,
		publicReactions: !!publicReactions.value,
		followingVisibility: followingVisibility.value,
		followersVisibility: followersVisibility.value,
		chatScope: chatScope.value,
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.privacy,
	icon: 'ti ti-lock-open',
}));
</script>
