<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<MkStickyContainer>
		<template #header><XHeader :actions="headerActions" :tabs="headerTabs"/></template>
		<MkSpacer :contentMax="700">
			<div class="_gaps">
				<MkFolder>
					<template #label>{{ i18n.ts._role.baseRole }}</template>
					<div class="_gaps_s">
						<MkInput v-model="baseRoleQ" type="text">
							<template #prefix><i class="ti ti-search"></i></template>
						</MkInput>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.rateLimitFactor, 'rateLimitFactor'])">
							<template #label>{{ i18n.ts._role._options.rateLimitFactor }}</template>
							<template #suffix>{{ Math.floor(policies.rateLimitFactor * 100) }}%</template>
							<MkRange :modelValue="policies.rateLimitFactor * 100" :min="30" :max="300" :step="10" :textConverter="(v) => `${v}%`" @update:modelValue="v => policies.rateLimitFactor = (v / 100)">
								<template #caption>{{ i18n.ts._role._options.descriptionOfRateLimitFactor }}</template>
							</MkRange>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.gtlAvailable, 'gtlAvailable'])">
							<template #label>{{ i18n.ts._role._options.gtlAvailable }}</template>
							<template #suffix>{{ policies.gtlAvailable ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.gtlAvailable">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.ltlAvailable, 'ltlAvailable'])">
							<template #label>{{ i18n.ts._role._options.ltlAvailable }}</template>
							<template #suffix>{{ policies.ltlAvailable ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.ltlAvailable">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canPublicNote, 'canPublicNote'])">
							<template #label>{{ i18n.ts._role._options.canPublicNote }}</template>
							<template #suffix>{{ policies.canPublicNote ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canPublicNote">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canScheduleNote, 'canScheduleNote'])">
							<template #label>{{ i18n.ts._role._options.canScheduleNote }}</template>
							<template #suffix>{{ policies.canScheduleNote ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canScheduleNote">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.scheduleNoteLimit, 'scheduleNoteLimit'])">
							<template #label>{{ i18n.ts._role._options.scheduleNoteLimit }}</template>
							<template #suffix>{{ policies.scheduleNoteLimit }}</template>
							<MkInput v-model="policies.scheduleNoteLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.scheduleNoteMaxDays, 'scheduleNoteMaxDays'])">
							<template #label>{{ i18n.ts._role._options.scheduleNoteMaxDays }}</template>
							<template #suffix>{{ policies.scheduleNoteMaxDays }}</template>
							<MkInput v-model="policies.scheduleNoteMaxDays" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canInitiateConversation, 'canInitiateConversation'])">
							<template #label>{{ i18n.ts._role._options.canInitiateConversation }}</template>
							<template #suffix>{{ policies.canInitiateConversation ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canInitiateConversation">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canCreateContent, 'canCreateContent'])">
							<template #label>{{ i18n.ts._role._options.canCreateContent }}</template>
							<template #suffix>{{ policies.canCreateContent ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canCreateContent">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canUpdateContent, 'canUpdateContent'])">
							<template #label>{{ i18n.ts._role._options.canUpdateContent }}</template>
							<template #suffix>{{ policies.canUpdateContent ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canUpdateContent">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canDeleteContent, 'canDeleteContent'])">
							<template #label>{{ i18n.ts._role._options.canDeleteContent }}</template>
							<template #suffix>{{ policies.canDeleteContent ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canDeleteContent">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canPurgeAccount, 'canPurgeAccount'])">
							<template #label>{{ i18n.ts._role._options.canPurgeAccount }}</template>
							<template #suffix>{{ policies.canPurgeAccount ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canPurgeAccount">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canUpdateAvatar, 'canUpdateAvatar'])">
							<template #label>{{ i18n.ts._role._options.canUpdateAvatar }}</template>
							<template #suffix>{{ policies.canUpdateAvatar ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canUpdateAvatar">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canUpdateBanner, 'canUpdateBanner'])">
							<template #label>{{ i18n.ts._role._options.canUpdateBanner }}</template>
							<template #suffix>{{ policies.canUpdateBanner ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canUpdateBanner">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.mentionMax, 'mentionLimit'])">
							<template #label>{{ i18n.ts._role._options.mentionMax }}</template>
							<template #suffix>{{ policies.mentionLimit }}</template>
							<MkInput v-model="policies.mentionLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canInvite, 'canInvite'])">
							<template #label>{{ i18n.ts._role._options.canInvite }}</template>
							<template #suffix>{{ policies.canInvite ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canInvite">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.inviteLimit, 'inviteLimit'])">
							<template #label>{{ i18n.ts._role._options.inviteLimit }}</template>
							<template #suffix>{{ policies.inviteLimit }}</template>
							<MkInput v-model="policies.inviteLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.inviteLimitCycle, 'inviteLimitCycle'])">
							<template #label>{{ i18n.ts._role._options.inviteLimitCycle }}</template>
							<template #suffix>{{ policies.inviteLimitCycle + i18n.ts._time.minute }}</template>
							<MkInput v-model="policies.inviteLimitCycle" type="number">
								<template #suffix>{{ i18n.ts._time.minute }}</template>
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.inviteExpirationTime, 'inviteExpirationTime'])">
							<template #label>{{ i18n.ts._role._options.inviteExpirationTime }}</template>
							<template #suffix>{{ policies.inviteExpirationTime + i18n.ts._time.minute }}</template>
							<MkInput v-model="policies.inviteExpirationTime" type="number">
								<template #suffix>{{ i18n.ts._time.minute }}</template>
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canManageAvatarDecorations, 'canManageAvatarDecorations'])">
							<template #label>{{ i18n.ts._role._options.canManageAvatarDecorations }}</template>
							<template #suffix>{{ policies.canManageAvatarDecorations ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canManageAvatarDecorations">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canManageCustomEmojis, 'canManageCustomEmojis'])">
							<template #label>{{ i18n.ts._role._options.canManageCustomEmojis }}</template>
							<template #suffix>{{ policies.canManageCustomEmojis ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canManageCustomEmojis">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canSearchNotes, 'canSearchNotes'])">
							<template #label>{{ i18n.ts._role._options.canSearchNotes }}</template>
							<template #suffix>{{ policies.canSearchNotes ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canSearchNotes">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canUseReaction, 'canUseReaction'])">
							<template #label>{{ i18n.ts._role._options.canUseReaction }}</template>
							<template #suffix>{{ policies.canUseReaction ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canUseReaction">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canUseTranslator, 'canUseTranslator'])">
							<template #label>{{ i18n.ts._role._options.canUseTranslator }}</template>
							<template #suffix>{{ policies.canUseTranslator ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canUseTranslator">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canUseDriveFileInSoundSettings, 'canUseDriveFileInSoundSettings'])">
							<template #label>{{ i18n.ts._role._options.canUseDriveFileInSoundSettings }}</template>
							<template #suffix>{{ policies.canUseDriveFileInSoundSettings ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canUseDriveFileInSoundSettings">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.driveCapacity, 'driveCapacityMb'])">
							<template #label>{{ i18n.ts._role._options.driveCapacity }}</template>
							<template #suffix>{{ policies.driveCapacityMb }}MB</template>
							<MkInput v-model="policies.driveCapacityMb" type="number">
								<template #suffix>MB</template>
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.alwaysMarkNsfw, 'alwaysMarkNsfw'])">
							<template #label>{{ i18n.ts._role._options.alwaysMarkNsfw }}</template>
							<template #suffix>{{ policies.alwaysMarkNsfw ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.alwaysMarkNsfw">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.skipNsfwDetection, 'skipNsfwDetection'])">
							<template #label>{{ i18n.ts._role._options.skipNsfwDetection }}</template>
							<template #suffix>{{ policies.skipNsfwDetection ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.skipNsfwDetection">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.pinMax, 'pinLimit'])">
							<template #label>{{ i18n.ts._role._options.pinMax }}</template>
							<template #suffix>{{ policies.pinLimit }}</template>
							<MkInput v-model="policies.pinLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.antennaMax, 'antennaLimit'])">
							<template #label>{{ i18n.ts._role._options.antennaMax }}</template>
							<template #suffix>{{ policies.antennaLimit }}</template>
							<MkInput v-model="policies.antennaLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.antennaNotesMax, 'antennaNotesLimit'])">
							<template #label>{{ i18n.ts._role._options.antennaNotesMax }}</template>
							<template #suffix>{{ policies.antennaNotesLimit }}</template>
							<MkInput v-model="policies.antennaNotesLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.wordMuteMax, 'wordMuteLimit'])">
							<template #label>{{ i18n.ts._role._options.wordMuteMax }}</template>
							<template #suffix>{{ policies.wordMuteLimit }}</template>
							<MkInput v-model="policies.wordMuteLimit" type="number">
								<template #suffix>items</template>
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.webhookMax, 'webhookLimit'])">
							<template #label>{{ i18n.ts._role._options.webhookMax }}</template>
							<template #suffix>{{ policies.webhookLimit }}</template>
							<MkInput v-model="policies.webhookLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.clipMax, 'clipLimit'])">
							<template #label>{{ i18n.ts._role._options.clipMax }}</template>
							<template #suffix>{{ policies.clipLimit }}</template>
							<MkInput v-model="policies.clipLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.noteEachClipsMax, 'noteEachClipsLimit'])">
							<template #label>{{ i18n.ts._role._options.noteEachClipsMax }}</template>
							<template #suffix>{{ policies.noteEachClipsLimit }}</template>
							<MkInput v-model="policies.noteEachClipsLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.userListMax, 'userListLimit'])">
							<template #label>{{ i18n.ts._role._options.userListMax }}</template>
							<template #suffix>{{ policies.userListLimit }}</template>
							<MkInput v-model="policies.userListLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.userEachUserListsMax, 'userEachUserListsLimit'])">
							<template #label>{{ i18n.ts._role._options.userEachUserListsMax }}</template>
							<template #suffix>{{ policies.userEachUserListsLimit }}</template>
							<MkInput v-model="policies.userEachUserListsLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.mutualLinkSectionLimit, 'mutualLinkSectionLimit'])">
							<template #label>{{ i18n.ts._role._options.mutualLinkSectionLimit }}</template>
							<template #suffix>{{ policies.mutualLinkSectionLimit }}</template>
							<MkInput v-model="policies.mutualLinkSectionLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.mutualLinkLimit, 'mutualLinkLimit'])">
							<template #label>{{ i18n.ts._role._options.mutualLinkLimit }}</template>
							<template #suffix>{{ policies.mutualLinkLimit }}</template>
							<MkInput v-model="policies.mutualLinkLimit" type="number">
							</MkInput>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.canHideAds, 'canHideAds'])">
							<template #label>{{ i18n.ts._role._options.canHideAds }}</template>
							<template #suffix>{{ policies.canHideAds ? i18n.ts.yes : i18n.ts.no }}</template>
							<MkSwitch v-model="policies.canHideAds">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</MkFolder>

						<MkFolder v-if="matchQuery([i18n.ts._role._options.avatarDecorationLimit, 'avatarDecorationLimit'])">
							<template #label>{{ i18n.ts._role._options.avatarDecorationLimit }}</template>
							<template #suffix>{{ policies.avatarDecorationLimit }}</template>
							<MkInput v-model="policies.avatarDecorationLimit" type="number" :min="0">
							</MkInput>
						</MkFolder>

						<MkButton primary rounded @click="updateBaseRole">{{ i18n.ts.save }}</MkButton>
					</div>
				</MkFolder>
				<MkButton primary rounded @click="create"><i class="ti ti-plus"></i> {{ i18n.ts._role.new }}</MkButton>
				<div class="_gaps_s">
					<MkFoldableSection>
						<template #header>{{ i18n.ts._role.manualRoles }}</template>
						<div class="_gaps_s">
							<MkRolePreview v-for="role in roles.filter(x => x.target === 'manual')" :key="role.id" :role="role" :forModeration="true"/>
						</div>
					</MkFoldableSection>
					<MkFoldableSection>
						<template #header>{{ i18n.ts._role.conditionalRoles }}</template>
						<div class="_gaps_s">
							<MkRolePreview v-for="role in roles.filter(x => x.target === 'conditional')" :key="role.id" :role="role" :forModeration="true"/>
						</div>
					</MkFoldableSection>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</div>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';
import XHeader from './_header_.vue';
import MkInput from '@/components/MkInput.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkButton from '@/components/MkButton.vue';
import MkRange from '@/components/MkRange.vue';
import MkRolePreview from '@/components/MkRolePreview.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/scripts/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import { instance } from '@/instance.js';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import { ROLE_POLICIES } from '@/const.js';
import { useRouter } from '@/router/supplier.js';

const router = useRouter();
const baseRoleQ = ref('');

const roles = await misskeyApi('admin/roles/list');

const policies = reactive<Record<typeof ROLE_POLICIES[number], any>>({});
for (const ROLE_POLICY of ROLE_POLICIES) {
	policies[ROLE_POLICY] = instance.policies[ROLE_POLICY];
}

function matchQuery(keywords: string[]): boolean {
	if (baseRoleQ.value.trim().length === 0) return true;
	return keywords.some(keyword => keyword.toLowerCase().includes(baseRoleQ.value.toLowerCase()));
}

async function updateBaseRole() {
	await os.apiWithDialog('admin/roles/update-default-policies', {
		policies,
	});
}

function create() {
	router.push('/admin/roles/new');
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePageMetadata(() => ({
	title: i18n.ts.roles,
	icon: 'ti ti-badges',
}));
</script>

<style lang="scss" module>

</style>
