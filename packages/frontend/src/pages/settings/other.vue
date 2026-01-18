<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/other" :label="i18n.ts.other" :keywords="['other']" icon="ti ti-dots">
	<div class="_gaps_m">
		<!--
		<MkSwitch v-model="$i.injectFeaturedNote" @update:model-value="onChangeInjectFeaturedNote">
			<template #label>{{ i18n.ts.showFeaturedNotesInTimeline }}</template>
		</MkSwitch>
		-->

		<!--
		<MkSwitch v-model="reportError">{{ i18n.ts.sendErrorReports }}<template #caption>{{ i18n.ts.sendErrorReportsDescription }}</template></MkSwitch>
		-->

		<div class="_gaps_s">
			<SearchMarker :keywords="['account', 'info']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-info-circle"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.accountInfo }}</SearchLabel></template>

					<div class="_gaps_m">
						<MkKeyValue>
							<template #key>ID</template>
							<template #value><span class="_monospace">{{ $i.id }}</span></template>
						</MkKeyValue>

					<MkKeyValue>
						<template #key>{{ i18n.ts.registeredDate }}</template>
						<template #value><MkTime :time="$i.createdAt" mode="detail"/></template>
					</MkKeyValue>

						<SearchMarker :keywords="['role', 'policy']">
							<MkFolder>
								<template #icon><i class="ti ti-badges"></i></template>
								<template #label><SearchLabel>{{ i18n.ts._role.policies }}</SearchLabel></template>

								<div class="_gaps_s">
									<div v-for="policy in Object.keys($i.policies)" :key="policy">
										{{ policy }} ... {{ $i.policies[policy] }}
									</div>
								</div>
							</MkFolder>
						</SearchMarker>

					<FormLink to="/settings/account-stats"><template #icon><i class="ti ti-info-circle"/></template>{{ i18n.ts.statistics }}</FormLink>
				</div>
			</MkFolder>

			</SearchMarker>

			<SearchMarker :keywords="['timeline', 'cache']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-database"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.timelineCache }}</SearchLabel></template>

					<div class="_gaps_m">
						<div>{{ i18n.ts.timelineCacheDescription }}</div>

						<div class="_gaps_s">
							<MkButton @click="clearFanoutTimeline('home')"><i class="ti ti-trash"></i> {{ i18n.ts.purgeHomeTimelineCache }}</MkButton>
							<MkButton @click="clearFanoutTimeline('user')"><i class="ti ti-trash"></i> {{ i18n.ts.purgeUserTimelineCache }}</MkButton>
						</div>

						<div class="_gaps_s">
							<MkSelect v-model="selectedListId" :disabled="userLists?.length === 0">
								<template #label>{{ i18n.ts.selectList }}</template>
								<option v-for="list in userLists" :key="list.id" :value="list.id">{{ list.name }}</option>
							</MkSelect>
							<MkButton :disabled="!selectedListId" @click="clearFanoutTimeline('list', selectedListId)"><i class="ti ti-trash"></i> {{ i18n.ts.purgeUserListTimelineCache }}</MkButton>
						</div>

						<div class="_gaps_s">
							<MkSelect v-model="selectedAntennaId" :disabled="antennas?.length === 0">
								<template #label>{{ i18n.ts.selectAntenna }}</template>
								<option v-for="antenna in antennas" :key="antenna.id" :value="antenna.id">{{ antenna.name }}</option>
							</MkSelect>
							<MkButton :disabled="!selectedAntennaId" @click="clearFanoutTimeline('antenna', selectedAntennaId)"><i class="ti ti-trash"></i> {{ i18n.ts.purgeAntennaTimelineCache }}</MkButton>
						</div>
					</div>
				</MkFolder>
			</SearchMarker>

			<SearchMarker :keywords="['roles']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-badges"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.rolesAssignedToMe }}</SearchLabel></template>

					<div class="_gaps_s">
						<MkRolePreview v-for="role in $i.roles" :key="role.id" :role="role" :forModeration="false"/>
					</div>
				</MkFolder>
			</SearchMarker>

			<SearchMarker :keywords="['account', 'move', 'migration']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-plane"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.accountMigration }}</SearchLabel></template>

					<XMigration/>
				</MkFolder>
			</SearchMarker>

			<SearchMarker :keywords="['account', 'close', 'delete']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-alert-triangle"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.closeAccount }}</SearchLabel></template>

					<div class="_gaps_m">
						<FormInfo warn>{{ i18n.ts._accountDelete.mayTakeTime }}</FormInfo>
						<FormInfo>{{ i18n.ts._accountDelete.sendEmail }}</FormInfo>
						<MkButton v-if="!$i.isDeleted" danger @click="deleteAccount"><SearchText>{{ i18n.ts._accountDelete.requestAccountDelete }}</SearchText></MkButton>
						<MkButton v-else disabled>{{ i18n.ts._accountDelete.inProgress }}</MkButton>
					</div>
				</MkFolder>
			</SearchMarker>

			<SearchMarker :keywords="['experimental', 'feature', 'flags']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-flask"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.experimentalFeatures }}</SearchLabel></template>

					<div class="_gaps_m">
						<MkSwitch v-model="enableCondensedLine">
							<template #label>Enable condensed line</template>
						</MkSwitch>
						<MkSwitch v-model="skipNoteRender">
							<template #label>Enable note render skipping</template>
						</MkSwitch>
						<MkSwitch v-model="stackingRouterView">
							<template #label>Enable stacking router view</template>
						</MkSwitch>
						<MkSwitch v-model="enableFolderPageView">
							<template #label>Enable folder page view</template>
						</MkSwitch>
						<MkSwitch v-model="enableHapticFeedback">
							<template #label>Enable haptic feedback</template>
						</MkSwitch>
						<MkSwitch v-model="enableWebTranslatorApi">
							<template #label>Enable in-browser translator API</template>
						</MkSwitch>
					</div>
				</MkFolder>
			</SearchMarker>

			<SearchMarker :keywords="['developer', 'mode', 'debug']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-code"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.developer }}</SearchLabel></template>

					<div class="_gaps_m">
						<MkSwitch v-model="devMode">
							<template #label>{{ i18n.ts.devMode }}</template>
						</MkSwitch>
					</div>
				</MkFolder>
			</SearchMarker>
		</div>

		<hr>

		<FormLink to="/registry"><template #icon><i class="ti ti-adjustments"></i></template>{{ i18n.ts.registry }}</FormLink>

		<hr>

		<MkButton @click="resetAllTips"><i class="ti ti-bulb"></i> {{ i18n.ts.redisplayAllTips }}</MkButton>
		<MkButton @click="hideAllTips"><i class="ti ti-bulb-off"></i> {{ i18n.ts.hideAllTips }}</MkButton>

		<hr>

		<template v-if="$i.policies.chatAvailability !== 'unavailable'">
			<MkButton @click="readAllChatMessages">{{ i18n.ts.readAllChatMessages }}</MkButton>

			<hr>
		</template>

		<MkButton @click="forceCloudBackup">{{ i18n.ts._preferencesBackup.forceBackup }}</MkButton>

		<FormSlot>
			<MkButton danger @click="migrate"><i class="ti ti-refresh"></i> {{ i18n.ts.migrateOldSettings }}</MkButton>
			<template #caption>{{ i18n.ts.migrateOldSettings_description }}</template>
		</FormSlot>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import * as Misskey from 'misskey-js';
import XMigration from './migration.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import FormLink from '@/components/form/link.vue';
import MkFolder from '@/components/MkFolder.vue';
import FormInfo from '@/components/MkInfo.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import MkButton from '@/components/MkButton.vue';
import MkSelect from '@/components/MkSelect.vue';
import FormSlot from '@/components/form/slot.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { ensureSignin } from '@/i.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { prefer } from '@/preferences.js';
import MkRolePreview from '@/components/MkRolePreview.vue';
import { signout } from '@/signout.js';
import { migrateOldSettings } from '@/pref-migrate.js';
import { hideAllTips as _hideAllTips, resetAllTips as _resetAllTips } from '@/tips.js';
import { suggestReload } from '@/utility/reload-suggest.js';
import { cloudBackup } from '@/preferences/utility.js';

const $i = ensureSignin();

const reportError = prefer.model('reportError');
const enableCondensedLine = prefer.model('enableCondensedLine');
const skipNoteRender = prefer.model('skipNoteRender');
const devMode = prefer.model('devMode');
const stackingRouterView = prefer.model('experimental.stackingRouterView');
const userLists = ref<Misskey.entities.UserList[]>([]);
const antennas = ref<Misskey.entities.Antenna[]>([]);
const selectedListId = ref<string | null>(null);
const selectedAntennaId = ref<string | null>(null);
const enableFolderPageView = prefer.model('experimental.enableFolderPageView');
const enableHapticFeedback = prefer.model('experimental.enableHapticFeedback');
const enableWebTranslatorApi = prefer.model('experimental.enableWebTranslatorApi');

watch(skipNoteRender, () => {
	suggestReload();
});

onMounted(async () => {
	try {
		userLists.value = await misskeyApi('users/lists/list', {});
		antennas.value = await misskeyApi('antennas/list', {});
	} catch (error) {
		console.error('Failed to load lists or antennas', error);
	}
});

async function deleteAccount() {
	{
		const { canceled } = await os.confirm({
			type: 'warning',
			text: i18n.ts.deleteAccountConfirmAndWarn,
			okWaitInitiate: 'dialog',
			okWaitDuration: 5,
		});
		if (canceled) return;
	}

	const auth = await os.authenticateDialog();
	if (auth.canceled) return;

	await os.apiWithDialog('i/delete-account', {
		password: auth.result.password,
		token: auth.result.token,
	});

	await os.alert({
		title: i18n.ts._accountDelete.started,
		text: i18n.ts._accountDelete.dontLogin,
	});

	await signout();
}

async function clearFanoutTimeline(type: 'home' | 'user' | 'list' | 'antenna', targetId?: string | null) {
	const { canceled } = await os.confirm({
		type: 'warning',
		title: i18n.ts.timelineCache,
		text: i18n.ts.purgeTimelineCacheConfirm,
	});
	if (canceled) return;

	await os.apiWithDialog('i/purge-timeline-cache', {
		type,
		listId: type === 'list' ? targetId : undefined,
		antennaId: type === 'antenna' ? targetId : undefined,
	});
}

function migrate() {
	migrateOldSettings();
}

function resetAllTips() {
	_resetAllTips();
	os.success();
}

function hideAllTips() {
	_hideAllTips();
	os.success();
}

function readAllChatMessages() {
	os.apiWithDialog('chat/read-all', {});
}

async function forceCloudBackup() {
	await cloudBackup();
	os.success();
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.other,
	icon: 'ti ti-dots',
}));
</script>
