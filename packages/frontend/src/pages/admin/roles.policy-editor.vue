<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
	<div class="_gaps_s">
		<XFolder v-if="matchQuery([i18n.ts._role._options.rateLimitFactor, 'rateLimitFactor'])" v-model:policyMeta="policyMetaModel.rateLimitFactor" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.rateLimitFactor }}</template>
			<template #valueText>{{ Math.floor(valuesModel.rateLimitFactor * 100) }}%</template>
			<template #default="{ disabled }">
				<MkRange v-model="valuesModel.rateLimitFactor" :disabled="disabled" :min="0.3" :max="3" :step="0.1" :textConverter="(v) => `${Math.round(v * 100)}%`">
					<template #caption>{{ i18n.ts._role._options.descriptionOfRateLimitFactor }}</template>
				</MkRange>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.gtlAvailable, 'gtlAvailable'])" v-model:policyMeta="policyMetaModel.gtlAvailable" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.gtlAvailable }}</template>
			<template #valueText>{{ valuesModel.gtlAvailable ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.gtlAvailable" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.ltlAvailable, 'ltlAvailable'])" v-model:policyMeta="policyMetaModel.ltlAvailable" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.ltlAvailable }}</template>
			<template #valueText>{{ valuesModel.ltlAvailable ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.ltlAvailable" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canPublicNote, 'canPublicNote'])" v-model:policyMeta="policyMetaModel.canPublicNote" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canPublicNote }}</template>
			<template #valueText>{{ valuesModel.canPublicNote ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canPublicNote" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canScheduleNote, 'canScheduleNote'])" v-model:policyMeta="policyMetaModel.canScheduleNote" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canScheduleNote }}</template>
			<template #valueText>{{ valuesModel.canScheduleNote ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canScheduleNote" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.scheduleNoteLimit, 'scheduleNoteLimit'])" v-model:policyMeta="policyMetaModel.scheduleNoteLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.scheduleNoteLimit }}</template>
			<template #valueText>{{ valuesModel.scheduleNoteLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.scheduleNoteLimit" type="number" :disabled="disabled" :min="0">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.scheduleNoteMaxDays, 'scheduleNoteMaxDays'])" v-model:policyMeta="policyMetaModel.scheduleNoteMaxDays" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.scheduleNoteMaxDays }}</template>
			<template #valueText>{{ valuesModel.scheduleNoteMaxDays }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.scheduleNoteMaxDays" type="number" :disabled="disabled" :min="0">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canInitiateConversation, 'canInitiateConversation'])" v-model:policyMeta="policyMetaModel.canInitiateConversation" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canInitiateConversation }}</template>
			<template #valueText>{{ valuesModel.canInitiateConversation ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canInitiateConversation" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canCreateContent, 'canCreateContent'])" v-model:policyMeta="policyMetaModel.canCreateContent" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canCreateContent }}</template>
			<template #valueText>{{ valuesModel.canCreateContent ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canCreateContent" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canUpdateContent, 'canUpdateContent'])" v-model:policyMeta="policyMetaModel.canUpdateContent" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canUpdateContent }}</template>
			<template #valueText>{{ valuesModel.canUpdateContent ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canUpdateContent" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canDeleteContent, 'canDeleteContent'])" v-model:policyMeta="policyMetaModel.canDeleteContent" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canDeleteContent }}</template>
			<template #valueText>{{ valuesModel.canDeleteContent ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canDeleteContent" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canPurgeAccount, 'canPurgeAccount'])" v-model:policyMeta="policyMetaModel.canPurgeAccount" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canPurgeAccount }}</template>
			<template #valueText>{{ valuesModel.canPurgeAccount ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canPurgeAccount" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canUpdateAvatar, 'canUpdateAvatar'])" v-model:policyMeta="policyMetaModel.canUpdateAvatar" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canUpdateAvatar }}</template>
			<template #valueText>{{ valuesModel.canUpdateAvatar ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canUpdateAvatar" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canUpdateBanner, 'canUpdateBanner'])" v-model:policyMeta="policyMetaModel.canUpdateBanner" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canUpdateBanner }}</template>
			<template #valueText>{{ valuesModel.canUpdateBanner ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canUpdateBanner" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.chatAvailability, 'chatAvailability'])" v-model:policyMeta="policyMetaModel.chatAvailability" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.chatAvailability }}</template>
			<template #valueText>{{ valuesModel.chatAvailability === 'available' ? i18n.ts.yes : valuesModel.chatAvailability === 'readonly' ? i18n.ts.readonly : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSelect
					v-model="valuesModel.chatAvailability"
					:disabled="disabled"
					:items="[
						{ label: i18n.ts.enabled, value: 'available' },
						{ label: i18n.ts.readonly, value: 'readonly' },
						{ label: i18n.ts.disabled, value: 'unavailable' },
					]"
				>
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSelect>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.mentionMax, 'mentionLimit'])" v-model:policyMeta="policyMetaModel.mentionLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.mentionMax }}</template>
			<template #valueText>{{ valuesModel.mentionLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.mentionLimit" type="number" :disabled="disabled">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canInvite, 'canInvite'])" v-model:policyMeta="policyMetaModel.canInvite" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canInvite }}</template>
			<template #valueText>{{ valuesModel.canInvite ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canInvite" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.inviteLimit, 'inviteLimit'])" v-model:policyMeta="policyMetaModel.inviteLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.inviteLimit }}</template>
			<template #valueText>{{ valuesModel.inviteLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.inviteLimit" type="number" :disabled="disabled">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.inviteLimitCycle, 'inviteLimitCycle'])" v-model:policyMeta="policyMetaModel.inviteLimitCycle" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.inviteLimitCycle }}</template>
			<template #valueText>{{ valuesModel.inviteLimitCycle + i18n.ts._time.minute }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.inviteLimitCycle" type="number" :disabled="disabled">
					<template #suffix>{{ i18n.ts._time.minute }}</template>
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.inviteExpirationTime, 'inviteExpirationTime'])" v-model:policyMeta="policyMetaModel.inviteExpirationTime" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.inviteExpirationTime }}</template>
			<template #valueText>{{ valuesModel.inviteExpirationTime + i18n.ts._time.minute }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.inviteExpirationTime" type="number" :disabled="disabled">
					<template #suffix>{{ i18n.ts._time.minute }}</template>
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canManageAvatarDecorations, 'canManageAvatarDecorations'])" v-model:policyMeta="policyMetaModel.canManageAvatarDecorations" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canManageAvatarDecorations }}</template>
			<template #valueText>{{ valuesModel.canManageAvatarDecorations ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canManageAvatarDecorations" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canManageCustomEmojis, 'canManageCustomEmojis'])" v-model:policyMeta="policyMetaModel.canManageCustomEmojis" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canManageCustomEmojis }}</template>
			<template #valueText>{{ valuesModel.canManageCustomEmojis ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canManageCustomEmojis" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canSearchNotes, 'canSearchNotes'])" v-model:policyMeta="policyMetaModel.canSearchNotes" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canSearchNotes }}</template>
			<template #valueText>{{ valuesModel.canSearchNotes ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canSearchNotes" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canSearchUsers, 'canSearchUsers'])" v-model:policyMeta="policyMetaModel.canSearchUsers" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canSearchUsers }}</template>
			<template #valueText>{{ valuesModel.canSearchUsers ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canSearchUsers" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canUseTranslator, 'canUseTranslator'])" v-model:policyMeta="policyMetaModel.canUseTranslator" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canUseTranslator }}</template>
			<template #valueText>{{ valuesModel.canUseTranslator ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canUseTranslator" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canUseDriveFileInSoundSettings, 'canUseDriveFileInSoundSettings'])" v-model:policyMeta="policyMetaModel.canUseDriveFileInSoundSettings" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canUseDriveFileInSoundSettings }}</template>
			<template #valueText>{{ valuesModel.canUseDriveFileInSoundSettings ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canUseDriveFileInSoundSettings" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canUseReaction, 'canUseReaction'])" v-model:policyMeta="policyMetaModel.canUseReaction" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canUseReaction }}</template>
			<template #valueText>{{ valuesModel.canUseReaction ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canUseReaction" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canCreateChannel, 'canCreateChannel'])" v-model:policyMeta="policyMetaModel.canCreateChannel" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canCreateChannel }}</template>
			<template #valueText>{{ valuesModel.canCreateChannel ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canCreateChannel" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.driveCapacity, 'driveCapacityMb'])" v-model:policyMeta="policyMetaModel.driveCapacityMb" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.driveCapacity }}</template>
			<template #valueText>{{ valuesModel.driveCapacityMb }}MB</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.driveCapacityMb" type="number" :disabled="disabled">
					<template #suffix>MB</template>
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.maxFileSize, 'maxFileSizeMb'])" v-model:policyMeta="policyMetaModel.maxFileSizeMb" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.maxFileSize }}</template>
			<template #valueText>{{ valuesModel.maxFileSizeMb }}MB</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.maxFileSizeMb" type="number" :disabled="disabled">
					<template #suffix>MB</template>
					<template #caption>
						<div><i class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i> {{ i18n.ts._role._options.maxFileSize_caption }}</div>
					</template>
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.uploadableFileTypes, 'uploadableFileTypes'])" v-model:policyMeta="policyMetaModel.uploadableFileTypes" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.uploadableFileTypes }}</template>
			<template #valueText>...</template>
			<template #default="{ disabled }">
				<MkTextarea :modelValue="valuesModel.uploadableFileTypes.join('\n')" :disabled="disabled" @update:modelValue="v => valuesModel.uploadableFileTypes = v.split('\n')">
					<template #caption>
						<div>{{ i18n.ts._role._options.uploadableFileTypes_caption }}</div>
						<div><i class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i> {{ i18n.tsx._role._options.uploadableFileTypes_caption2({ x: 'application/octet-stream' }) }}</div>
					</template>
				</MkTextarea>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.alwaysMarkNsfw, 'alwaysMarkNsfw'])" v-model:policyMeta="policyMetaModel.alwaysMarkNsfw" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.alwaysMarkNsfw }}</template>
			<template #valueText>{{ valuesModel.alwaysMarkNsfw ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.alwaysMarkNsfw" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canUpdateBioMedia, 'canUpdateBioMedia'])" v-model:policyMeta="policyMetaModel.canUpdateBioMedia" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canUpdateBioMedia }}</template>
			<template #valueText>{{ valuesModel.canUpdateBioMedia ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canUpdateBioMedia" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.skipNsfwDetection, 'skipNsfwDetection'])" v-model:policyMeta="policyMetaModel.skipNsfwDetection" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.skipNsfwDetection }}</template>
			<template #valueText>{{ valuesModel.skipNsfwDetection ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.skipNsfwDetection" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.pinMax, 'pinLimit'])" v-model:policyMeta="policyMetaModel.pinLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.pinMax }}</template>
			<template #valueText>{{ valuesModel.pinLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.pinLimit" type="number" :disabled="disabled">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.antennaMax, 'antennaLimit'])" v-model:policyMeta="policyMetaModel.antennaLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.antennaMax }}</template>
			<template #valueText>{{ valuesModel.antennaLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.antennaLimit" type="number" :disabled="disabled">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.antennaNotesMax, 'antennaNotesLimit'])" v-model:policyMeta="policyMetaModel.antennaNotesLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.antennaNotesMax }}</template>
			<template #valueText>{{ valuesModel.antennaNotesLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.antennaNotesLimit" type="number" :disabled="disabled" :min="0">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.wordMuteMax, 'wordMuteLimit'])" v-model:policyMeta="policyMetaModel.wordMuteLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.wordMuteMax }}</template>
			<template #valueText>{{ valuesModel.wordMuteLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.wordMuteLimit" type="number" :disabled="disabled">
					<template #suffix>items</template>
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.webhookMax, 'webhookLimit'])" v-model:policyMeta="policyMetaModel.webhookLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.webhookMax }}</template>
			<template #valueText>{{ valuesModel.webhookLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.webhookLimit" type="number" :disabled="disabled">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.clipMax, 'clipLimit'])" v-model:policyMeta="policyMetaModel.clipLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.clipMax }}</template>
			<template #valueText>{{ valuesModel.clipLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.clipLimit" type="number" :disabled="disabled">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.noteEachClipsMax, 'noteEachClipsLimit'])" v-model:policyMeta="policyMetaModel.noteEachClipsLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.noteEachClipsMax }}</template>
			<template #valueText>{{ valuesModel.noteEachClipsLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.noteEachClipsLimit" type="number" :disabled="disabled">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.userListMax, 'userListLimit'])" v-model:policyMeta="policyMetaModel.userListLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.userListMax }}</template>
			<template #valueText>{{ valuesModel.userListLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.userListLimit" type="number" :disabled="disabled">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.userEachUserListsMax, 'userEachUserListsLimit'])" v-model:policyMeta="policyMetaModel.userEachUserListsLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.userEachUserListsMax }}</template>
			<template #valueText>{{ valuesModel.userEachUserListsLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.userEachUserListsLimit" type="number" :disabled="disabled">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.mutualLinkSectionLimit, 'mutualLinkSectionLimit'])" v-model:policyMeta="policyMetaModel.mutualLinkSectionLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.mutualLinkSectionLimit }}</template>
			<template #valueText>{{ valuesModel.mutualLinkSectionLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.mutualLinkSectionLimit" type="number" :disabled="disabled" :min="0">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.mutualLinkLimit, 'mutualLinkLimit'])" v-model:policyMeta="policyMetaModel.mutualLinkLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.mutualLinkLimit }}</template>
			<template #valueText>{{ valuesModel.mutualLinkLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.mutualLinkLimit" type="number" :disabled="disabled" :min="0">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canHideAds, 'canHideAds'])" v-model:policyMeta="policyMetaModel.canHideAds" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canHideAds }}</template>
			<template #valueText>{{ valuesModel.canHideAds ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canHideAds" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.avatarDecorationLimit, 'avatarDecorationLimit'])" v-model:policyMeta="policyMetaModel.avatarDecorationLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.avatarDecorationLimit }}</template>
			<template #valueText>{{ valuesModel.avatarDecorationLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="avatarDecorationLimit" type="number" :disabled="disabled" :min="0" :max="16" @update:modelValue="updateAvatarDecorationLimit">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canImportAntennas, 'canImportAntennas'])" v-model:policyMeta="policyMetaModel.canImportAntennas" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canImportAntennas }}</template>
			<template #valueText>{{ valuesModel.canImportAntennas ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canImportAntennas" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canImportBlocking, 'canImportBlocking'])" v-model:policyMeta="policyMetaModel.canImportBlocking" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canImportBlocking }}</template>
			<template #valueText>{{ valuesModel.canImportBlocking ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canImportBlocking" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canImportFollowing, 'canImportFollowing'])" v-model:policyMeta="policyMetaModel.canImportFollowing" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canImportFollowing }}</template>
			<template #valueText>{{ valuesModel.canImportFollowing ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canImportFollowing" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canImportMuting, 'canImportMuting'])" v-model:policyMeta="policyMetaModel.canImportMuting" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canImportMuting }}</template>
			<template #valueText>{{ valuesModel.canImportMuting ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canImportMuting" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.canImportUserLists, 'canImportUserList'])" v-model:policyMeta="policyMetaModel.canImportUserLists" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.canImportUserLists }}</template>
			<template #valueText>{{ valuesModel.canImportUserLists ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.canImportUserLists" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.noteDraftLimit, 'noteDraftLimit'])" v-model:policyMeta="policyMetaModel.noteDraftLimit" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.noteDraftLimit }}</template>
			<template #valueText>{{ valuesModel.noteDraftLimit }}</template>
			<template #default="{ disabled }">
				<MkInput v-model="valuesModel.noteDraftLimit" type="number" :disabled="disabled" :min="0">
				</MkInput>
			</template>
		</XFolder>

		<XFolder v-if="matchQuery([i18n.ts._role._options.watermarkAvailable, 'watermarkAvailable'])" v-model:policyMeta="policyMetaModel.watermarkAvailable" :isBaseRole="isBaseRole" :readonly="readonly">
			<template #label>{{ i18n.ts._role._options.watermarkAvailable }}</template>
			<template #valueText>{{ valuesModel.watermarkAvailable ? i18n.ts.yes : i18n.ts.no }}</template>
			<template #default="{ disabled }">
				<MkSwitch v-model="valuesModel.watermarkAvailable" :disabled="disabled">
					<template #label>{{ i18n.ts.enable }}</template>
				</MkSwitch>
			</template>
		</XFolder>
	</div>
</template>

<script lang="ts">
import * as Misskey from 'misskey-js';

export type PolicyMeta = {
	useDefault: boolean;
	priority: number;
};

type PolicyMetaRecord = {
	[K in keyof Misskey.entities.RolePolicies]: PolicyMeta;
};
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { i18n } from '@/i18n.js';
import XFolder from './roles.policy-editor.folder.vue';

import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkRange from '@/components/MkRange.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkSelect from '@/components/MkSelect.vue';

const props = defineProps<{
	isBaseRole: boolean;
	rolePolicies: Misskey.entities.RolePolicies;
	policiesMeta?: PolicyMetaRecord;
	roleQuery?: string;
	readonly?: boolean;
}>();

const emit = defineEmits<{
	(event: 'update:rolePolicies', value: Misskey.entities.RolePolicies): void;
	(event: 'update:policiesMeta', value: PolicyMetaRecord): void;
}>();

const valuesModel = ref(props.rolePolicies);
watch(valuesModel, (newVal) => {
	emit('update:rolePolicies', newVal);
}, { deep: true });
watch(() => props.rolePolicies, () => {
	valuesModel.value = props.rolePolicies;
}, { deep: true });

function setPolicyMeta(incoming: Partial<PolicyMetaRecord> | undefined): PolicyMetaRecord {
	const meta: PolicyMetaRecord = {} as PolicyMetaRecord;
	for (const ROLE_POLICY of Misskey.rolePolicies) {
		meta[ROLE_POLICY] = incoming?.[ROLE_POLICY] ?? {
			useDefault: true,
			priority: 0,
		};
	}
	return meta;
}

const policyMetaModel = ref(setPolicyMeta(props.policiesMeta));
watch(policyMetaModel, (newVal) => {
	emit('update:policiesMeta', newVal);
}, { deep: true });
watch(() => props.policiesMeta, () => {
	policyMetaModel.value = setPolicyMeta(props.policiesMeta);
}, { deep: true });

function matchQuery(keywords: string[]): boolean {
	if (props.roleQuery == null || props.roleQuery.trim().length === 0) return true;
	return keywords.some(keyword => keyword.toLowerCase().includes(props.roleQuery!.toLowerCase()));
}

const avatarDecorationLimit = computed({
	get: () => Math.min(16, Math.max(0, Number(valuesModel.value.avatarDecorationLimit ?? 0))),
	set: (value) => {
		valuesModel.value.avatarDecorationLimit = Math.min(Number(value), 16);
	},
});

function updateAvatarDecorationLimit(value: string | number) {
	avatarDecorationLimit.value = Number(value);
}
</script>
