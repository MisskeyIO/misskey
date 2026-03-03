<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/privacy" :label="i18n.ts.privacy" :keywords="['privacy']" icon="ti ti-lock-open">
	<div class="_gaps_m">
		<MkFeatureBanner icon="/client-assets/unlocked_3d.png" color="#aeff00">
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

<!--		<SearchMarker :keywords="['chat']">-->
<!--			<FormSection>-->
<!--				<template #label><SearchLabel>{{ i18n.ts.directMessage }}</SearchLabel></template>-->

<!--				<div class="_gaps_m">-->
<!--					<MkInfo v-if="$i.policies.chatAvailability === 'unavailable'">{{ i18n.ts._chat.chatNotAvailableForThisAccountOrServer }}</MkInfo>-->
<!--					<SearchMarker :keywords="['chat']">-->
<!--						<MkSelect v-model="chatScope" :items="chatScopeDef" @update:modelValue="save()">-->
<!--							<template #label><SearchLabel>{{ i18n.ts._chat.chatAllowedUsers }}</SearchLabel></template>-->
<!--							<template #caption>{{ i18n.ts._chat.chatAllowedUsers_note }}</template>-->
<!--						</MkSelect>-->
<!--					</SearchMarker>-->
<!--				</div>-->
<!--			</FormSection>-->
<!--		</SearchMarker>-->


		<!--		<SearchMarker :keywords="['lockdown']">-->
		<!--			<FormSection>-->
		<!--				<template #label><SearchLabel>{{ i18n.ts.lockdown }}</SearchLabel><span class="_beta">{{ i18n.ts.beta }}</span></template>-->

		<!--				<div class="_gaps_m">-->
		<!--					<SearchMarker :keywords="['login', 'signin']">-->
		<!--						<MkSwitch :modelValue="requireSigninToViewContents" @update:modelValue="update_requireSigninToViewContents">-->
		<!--							<template #label><SearchLabel>{{ i18n.ts._accountSettings.requireSigninToViewContents }}</SearchLabel></template>-->
		<!--							<template #caption>-->
		<!--								<div>{{ i18n.ts._accountSettings.requireSigninToViewContentsDescription1 }}</div>-->
		<!--								<div><i class="ti ti-alert-triangle" style="color: var(&#45;&#45;MI_THEME-warn);"></i> {{ i18n.ts._accountSettings.requireSigninToViewContentsDescription2 }}</div>-->
		<!--							</template>-->
		<!--						</MkSwitch>-->
		<!--					</SearchMarker>-->

		<!--					<SearchMarker :keywords="['follower']">-->
		<!--						<FormSlot>-->
		<!--							<template #label><SearchLabel>{{ i18n.ts._accountSettings.makeNotesFollowersOnlyBefore }}</SearchLabel></template>-->

		<!--							<div class="_gaps_s">-->
		<!--								<MkSelect :modelValue="makeNotesFollowersOnlyBefore_type" @update:modelValue="makeNotesFollowersOnlyBefore = $event === 'relative' ? -604800 : $event === 'absolute' ? Math.floor(Date.now() / 1000) : null">-->
		<!--									<option :value="null">{{ i18n.ts.none }}</option>-->
		<!--									<option value="relative">{{ i18n.ts._accountSettings.notesHavePassedSpecifiedPeriod }}</option>-->
		<!--									<option value="absolute">{{ i18n.ts._accountSettings.notesOlderThanSpecifiedDateAndTime }}</option>-->
		<!--								</MkSelect>-->

		<!--								<MkSelect v-if="makeNotesFollowersOnlyBefore_type === 'relative'" v-model="makeNotesFollowersOnlyBefore">-->
		<!--									<option :value="-3600">{{ i18n.ts.oneHour }}</option>-->
		<!--									<option :value="-86400">{{ i18n.ts.oneDay }}</option>-->
		<!--									<option :value="-259200">{{ i18n.ts.threeDays }}</option>-->
		<!--									<option :value="-604800">{{ i18n.ts.oneWeek }}</option>-->
		<!--									<option :value="-2592000">{{ i18n.ts.oneMonth }}</option>-->
		<!--									<option :value="-7776000">{{ i18n.ts.threeMonths }}</option>-->
		<!--									<option :value="-31104000">{{ i18n.ts.oneYear }}</option>-->
		<!--								</MkSelect>-->

		<!--								<MkInput-->
		<!--									v-if="makeNotesFollowersOnlyBefore_type === 'absolute'"-->
		<!--									:modelValue="formatDateTimeString(new Date(makeNotesFollowersOnlyBefore * 1000), 'yyyy-MM-dd')"-->
		<!--									type="date"-->
		<!--									:manualSave="true"-->
		<!--									@update:modelValue="makeNotesFollowersOnlyBefore = Math.floor(new Date($event).getTime() / 1000)"-->
		<!--								>-->
		<!--								</MkInput>-->
		<!--							</div>-->

		<!--							<template #caption>-->
		<!--								<div><SearchKeyword>{{ i18n.ts._accountSettings.makeNotesFollowersOnlyBeforeDescription }}</SearchKeyword></div>-->
		<!--							</template>-->
		<!--						</FormSlot>-->
		<!--					</SearchMarker>-->

		<!--										<SearchMarker :keywords="['hidden']">-->
		<!--											<FormSlot>-->
		<!--												<template #label><SearchLabel>{{ i18n.ts._accountSettings.makeNotesHiddenBefore }}</SearchLabel></template>-->

		<!--												<div class="_gaps_s">-->
		<!--													<MkSelect :modelValue="makeNotesHiddenBefore_type" @update:modelValue="makeNotesHiddenBefore = $event === 'relative' ? -604800 : $event === 'absolute' ? Math.floor(Date.now() / 1000) : null">-->
		<!--														<option :value="null">{{ i18n.ts.none }}</option>-->
		<!--														<option value="relative">{{ i18n.ts._accountSettings.notesHavePassedSpecifiedPeriod }}</option>-->
		<!--														<option value="absolute">{{ i18n.ts._accountSettings.notesOlderThanSpecifiedDateAndTime }}</option>-->
		<!--													</MkSelect>-->

		<!--													<MkSelect v-if="makeNotesHiddenBefore_type === 'relative'" v-model="makeNotesHiddenBefore">-->
		<!--														<option :value="-3600">{{ i18n.ts.oneHour }}</option>-->
		<!--														<option :value="-86400">{{ i18n.ts.oneDay }}</option>-->
		<!--														<option :value="-259200">{{ i18n.ts.threeDays }}</option>-->
		<!--														<option :value="-604800">{{ i18n.ts.oneWeek }}</option>-->
		<!--														<option :value="-2592000">{{ i18n.ts.oneMonth }}</option>-->
		<!--														<option :value="-7776000">{{ i18n.ts.threeMonths }}</option>-->
		<!--														<option :value="-31104000">{{ i18n.ts.oneYear }}</option>-->
		<!--													</MkSelect>-->

		<!--													<MkInput-->
		<!--														v-if="makeNotesHiddenBefore_type === 'absolute'"-->
		<!--														:modelValue="formatDateTimeString(new Date(makeNotesHiddenBefore * 1000), 'yyyy-MM-dd')"-->
		<!--														type="date"-->
		<!--														:manualSave="true"-->
		<!--														@update:modelValue="makeNotesHiddenBefore = Math.floor(new Date($event).getTime() / 1000)"-->
		<!--													>-->
		<!--													</MkInput>-->
		<!--												</div>-->

		<!--												<template #caption>-->
		<!--													<div><SearchKeyword>{{ i18n.ts._accountSettings.makeNotesHiddenBeforeDescription }}</SearchKeyword></div>-->
		<!--												</template>-->
		<!--											</FormSlot>-->
		<!--										</SearchMarker>-->

		<!--					<MkInfo warn>{{ i18n.ts._accountSettings.mayNotEffectSomeSituations }}</MkInfo>-->
		<!--				</div>-->
		<!--			</FormSection>-->
		<!--		</SearchMarker>-->

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
import type { MkSelectItem } from '@/components/MkSelect.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { ensureSignin } from '@/i.js';
import { definePage } from '@/page.js';
import { useMkSelect } from '@/composables/use-mkselect.js';

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
const {
	model: chatScope,
	def: chatScopeDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts._chat._chatAllowedUsers.everyone, value: 'everyone' },
		{ label: i18n.ts._chat._chatAllowedUsers.followers, value: 'followers' },
		{ label: i18n.ts._chat._chatAllowedUsers.following, value: 'following' },
		{ label: i18n.ts._chat._chatAllowedUsers.mutual, value: 'mutual' },
		{ label: i18n.ts._chat._chatAllowedUsers.none, value: 'none' },
	],
	initialValue: $i.chatScope,
});

const makeNotesFollowersOnlyBefore_type = computed({
	get: () => {
		if (makeNotesFollowersOnlyBefore.value == null) {
			return null;
		} else if (makeNotesFollowersOnlyBefore.value >= 0) {
			return 'absolute';
		} else {
			return 'relative';
		}
	},
	set(value) {
		if (value === 'relative') {
			makeNotesFollowersOnlyBefore.value = -604800;
		} else if (value === 'absolute') {
			makeNotesFollowersOnlyBefore.value = Math.floor(Date.now() / 1000);
		} else {
			makeNotesFollowersOnlyBefore.value = null;
		}
	},
});

const makeNotesFollowersOnlyBefore_presets = [
	{ label: i18n.ts.oneHour, value: -3600 },
	{ label: i18n.ts.oneDay, value: -86400 },
	{ label: i18n.ts.threeDays, value: -259200 },
	{ label: i18n.ts.oneWeek, value: -604800 },
	{ label: i18n.ts.oneMonth, value: -2592000 },
	{ label: i18n.ts.threeMonths, value: -7776000 },
	{ label: i18n.ts.oneYear, value: -31104000 },
] satisfies MkSelectItem[];

const makeNotesFollowersOnlyBefore_isCustomMode = ref(
	makeNotesFollowersOnlyBefore.value != null &&
	makeNotesFollowersOnlyBefore.value < 0 &&
	!makeNotesFollowersOnlyBefore_presets.some((preset) => preset.value === makeNotesFollowersOnlyBefore.value),
);

const makeNotesFollowersOnlyBefore_selection = computed({
	get: () => makeNotesFollowersOnlyBefore_isCustomMode.value ? 'custom' : makeNotesFollowersOnlyBefore.value,
	set(value) {
		makeNotesFollowersOnlyBefore_isCustomMode.value = value === 'custom';
		if (value !== 'custom') makeNotesFollowersOnlyBefore.value = value;
	},
});

const makeNotesFollowersOnlyBefore_customMonths = computed({
	get: () => makeNotesFollowersOnlyBefore.value ? Math.abs(makeNotesFollowersOnlyBefore.value) / (30 * 24 * 60 * 60) : null,
	set(value) {
		if (value != null && value > 0) makeNotesFollowersOnlyBefore.value = -Math.abs(Math.floor(Number(value))) * 30 * 24 * 60 * 60;
	},
});

const makeNotesHiddenBefore_type = computed({
	get: () => {
		if (makeNotesHiddenBefore.value == null) {
			return null;
		} else if (makeNotesHiddenBefore.value >= 0) {
			return 'absolute';
		} else {
			return 'relative';
		}
	},
	set(value) {
		if (value === 'relative') {
			makeNotesHiddenBefore.value = -604800;
		} else if (value === 'absolute') {
			makeNotesHiddenBefore.value = Math.floor(Date.now() / 1000);
		} else {
			makeNotesHiddenBefore.value = null;
		}
	},
});

const makeNotesHiddenBefore_presets = [
	{ label: i18n.ts.oneHour, value: -3600 },
	{ label: i18n.ts.oneDay, value: -86400 },
	{ label: i18n.ts.threeDays, value: -259200 },
	{ label: i18n.ts.oneWeek, value: -604800 },
	{ label: i18n.ts.oneMonth, value: -2592000 },
	{ label: i18n.ts.threeMonths, value: -7776000 },
	{ label: i18n.ts.oneYear, value: -31104000 },
] satisfies MkSelectItem[];

const makeNotesHiddenBefore_isCustomMode = ref(
	makeNotesHiddenBefore.value != null &&
	makeNotesHiddenBefore.value < 0 &&
	!makeNotesHiddenBefore_presets.some((preset) => preset.value === makeNotesHiddenBefore.value),
);

const makeNotesHiddenBefore_selection = computed({
	get: () => makeNotesHiddenBefore_isCustomMode.value ? 'custom' : makeNotesHiddenBefore.value,
	set(value) {
		makeNotesHiddenBefore_isCustomMode.value = value === 'custom';
		if (value !== 'custom') makeNotesHiddenBefore.value = value;
	},
});

const makeNotesHiddenBefore_customMonths = computed({
	get: () => makeNotesHiddenBefore.value ? Math.abs(makeNotesHiddenBefore.value) / (30 * 24 * 60 * 60) : null,
	set(value) {
		if (value != null && value > 0) makeNotesHiddenBefore.value = -Math.abs(Math.floor(Number(value))) * 30 * 24 * 60 * 60;
	},
});

const gaConsentInternal = ref(miLocalStorage.getItem('gaConsent') === 'true');
const gaConsent = computed({
	get: () => gaConsentInternal.value,
	set: (value: boolean) => {
		miLocalStorage.setItem('gaConsent', value ? 'true' : 'false');
		gaConsentInternal.value = value;
	},
});
const gtagConsentInternal = ref({
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

// async function update_requireSigninToViewContents(value: boolean) {
// 	if (value === true && instance.federation !== 'none') {
// 		const { canceled } = await os.confirm({
// 			type: 'warning',
// 			text: i18n.ts.acknowledgeNotesAndEnable,
// 		});
// 		if (canceled) return;
// 	}
//
// 	requireSigninToViewContents.value = value;
// 	save();
// }

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
