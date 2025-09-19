<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div class="_gaps">
			<MkFolder>
				<template #label>{{ i18n.ts.options }}</template>

				<MkFolder>
					<template #label>{{ i18n.ts.specifyUser }}</template>
					<template v-if="user" #suffix>@{{ user.username }}</template>

					<div style="text-align: center;" class="_gaps">
						<div v-if="user">@{{ user.username }}</div>
						<div>
							<MkButton v-if="user == null" primary rounded inline @click="selectUserFilter">{{ i18n.ts.selectUser }}</MkButton>
							<MkButton v-else danger rounded inline @click="user = null">{{ i18n.ts.remove }}</MkButton>
						</div>
					</div>
				</MkFolder>
			</MkFolder>

			<MkSelect v-model="announcementsStatus">
				<template #label>{{ i18n.ts.filter }}</template>
				<option value="active">{{ i18n.ts.active }}</option>
				<option value="archived">{{ i18n.ts.archived }}</option>
			</MkSelect>

			<MkLoading v-if="loading"/>

			<template v-else>
				<MkFolder v-for="announcement in announcements" :key="announcement.id ?? announcement._id" :defaultOpen="announcement.id == null">
					<template #label>{{ announcement.title }}</template>
					<template #icon>
						<i v-if="announcement.id && !announcement.isActive" class="ti ti-archive"></i>
						<i v-if="announcement.icon === 'info'" class="ti ti-info-circle"></i>
						<i v-else-if="announcement.icon === 'warning'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i>
						<i v-else-if="announcement.icon === 'error'" class="ti ti-circle-x" style="color: var(--MI_THEME-error);"></i>
						<i v-else-if="announcement.icon === 'success'" class="ti ti-check" style="color: var(--MI_THEME-success);"></i>
					</template>
					<template #caption>{{ announcement.text }}</template>
					<template #footer>
						<div class="_buttons">
							<MkButton rounded primary @click="save(announcement)"><i class="ti ti-device-floppy"></i> {{ i18n.ts.save }}</MkButton>
							<MkButton v-if="announcement.id != null && announcement.isActive" rounded @click="archive(announcement)"><i class="ti ti-check"></i> {{ i18n.ts._announcement.end }} ({{ i18n.ts.archive }})</MkButton>
							<MkButton v-if="announcement.id != null && !announcement.isActive" rounded @click="unarchive(announcement)"><i class="ti ti-restore"></i> {{ i18n.ts.unarchive }}</MkButton>
							<MkButton v-if="announcement.id != null" rounded danger @click="del(announcement)"><i class="ti ti-trash"></i> {{ i18n.ts.delete }}</MkButton>
						</div>
					</template>

					<div class="_gaps_m">
						<MkInput ref="announceTitleEl" v-model="announcement.title" :large="false">
							<template #label>{{ i18n.ts.title }}&nbsp;<button v-tooltip="i18n.ts.emoji" :class="['_button']" @click="insertEmoji"><i class="ti ti-mood-happy"></i></button></template>
						</MkInput>
						<MkTextarea v-model="announcement.text" mfmAutocomplete :mfmPreview="true">
							<template #label>{{ i18n.ts.text }}</template>
						</MkTextarea>
						<MkInput v-model="announcement.imageUrl" type="url">
							<template #label>{{ i18n.ts.imageUrl }}</template>
						</MkInput>
						<MkRadios v-model="announcement.icon">
							<template #label>{{ i18n.ts.icon }}</template>
							<option value="info"><i class="ti ti-info-circle"></i></option>
							<option value="warning"><i class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i></option>
							<option value="error"><i class="ti ti-circle-x" style="color: var(--MI_THEME-error);"></i></option>
							<option value="success"><i class="ti ti-check" style="color: var(--MI_THEME-success);"></i></option>
						</MkRadios>
						<MkRadios v-model="announcement.display">
							<template #label>{{ i18n.ts.display }}</template>
							<option value="normal">{{ i18n.ts.normal }}</option>
							<option value="banner">{{ i18n.ts.banner }}</option>
							<option value="dialog">{{ i18n.ts.dialog }}</option>
						</MkRadios>
						<MkInfo v-if="announcement.display === 'dialog'" warn>{{ i18n.ts._announcement.dialogAnnouncementUxWarn }}</MkInfo>
						<MkSwitch v-model="announcement.forExistingUsers" :helpText="i18n.ts._announcement.forExistingUsersDescription">
							{{ i18n.ts._announcement.forExistingUsers }}
						</MkSwitch>
						<MkSwitch v-model="announcement.needConfirmationToRead" :helpText="i18n.ts._announcement.needConfirmationToReadDescription">
							{{ i18n.ts._announcement.needConfirmationToRead }}
						</MkSwitch>
						<MkSwitch v-model="announcement.needEnrollmentTutorialToRead" :helpText="i18n.ts._announcement.needEnrollmentTutorialToReadDescription">
							{{ i18n.ts._announcement.needEnrollmentTutorialToRead }}
						</MkSwitch>
						<MkInput v-model="announcement.closeDuration" type="number">
							<template #label>{{ i18n.ts.dialogCloseDuration }}</template>
							<template #suffix>{{ i18n.ts._time.second }}</template>
						</MkInput>
						<MkInput v-model="announcement.displayOrder" type="number">
							<template #label>{{ i18n.ts.displayOrder }}</template>
						</MkInput>
						<MkSwitch v-model="announcement.silence" :helpText="i18n.ts._announcement.silenceDescription">
							{{ i18n.ts._announcement.silence }}
						</MkSwitch>
						<p v-if="announcement.reads">{{ i18n.tsx.nUsersRead({ n: announcement.reads }) }} <span v-if="announcement.lastReadAt">(<MkTime :time="announcement.lastReadAt" mode="absolute"/>)</span></p>
						<MkUserCardMini v-if="announcement.userId" :user="announcement.user" @click="editUser(announcement)"></MkUserCardMini>
						<MkButton v-else class="button" inline primary @click="editUser(announcement)">{{ i18n.ts.specifyUser }}</MkButton>
						<div class="buttons _buttons">
							<MkButton v-if="announcement.id == null || announcement.isActive" class="button" inline primary @click="save(announcement)"><i class="ti ti-device-floppy"></i> {{ i18n.ts.save }}</MkButton>
							<MkButton v-if="announcement.id != null && announcement.isActive" class="button" inline @click="archive(announcement)"><i class="ti ti-check"></i> {{ i18n.ts._announcement.end }} ({{ i18n.ts.archive }})</MkButton>
							<MkButton v-if="announcement.id != null" class="button" inline danger @click="del(announcement)"><i class="ti ti-trash"></i> {{ i18n.ts.delete }}</MkButton>
						</div>
					</div>
				</MkFolder>
				<MkButton v-if="hasMore" :class="$style.more" :disabled="!hasMore || fetching" primary rounded @click="fetch()">
					<i class="ti ti-reload"></i>{{ fetching ? 'Loading...' : i18n.ts.more }}
				</MkButton>
			</template>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed, watch, useTemplateRef } from 'vue';
import * as misskey from 'misskey-js';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkFolder from '@/components/MkFolder.vue';
import MkUserCardMini from '@/components/MkUserCardMini.vue';

const announceTitleEl = useTemplateRef('announceTitleEl');
const user = ref<misskey.entities.UserLite | null>(null);
const offset = ref(0);
const hasMore = ref(false);
import MkTextarea from '@/components/MkTextarea.vue';

const announcementsStatus = ref<'active' | 'archived'>('active');

const loading = ref(true);
const fetching = ref(false);
let fetchSequence = 0;

const announcements = ref<any[]>([]);

function selectUserFilter(): void {
	os.selectUser().then(_user => {
		user.value = _user;
	});
}

function editUser(announcement): void {
	os.selectUser().then(_user => {
		announcement.userId = _user.id;
		announcement.user = _user;
	});
}

function insertEmoji(ev: MouseEvent): void {
	os.openEmojiPicker(
		(ev.currentTarget ?? ev.target) as HTMLElement,
		{ asReactionPicker: false },
		announceTitleEl.value,
	);
}

watch(announcementsStatus, async () => {
	await refresh();
}, { immediate: true });

function add() {
	announcements.value.unshift({
		_id: Math.random().toString(36),
		id: null,
		title: 'New announcement',
		text: '',
		imageUrl: null,
		icon: 'info',
		display: 'normal',
		forExistingUsers: false,
		needConfirmationToRead: false,
		closeDuration: 0,
		displayOrder: 0,
		silence: false,
	});
}

function del(announcement) {
	os.confirm({
		type: 'warning',
		text: i18n.tsx.deleteAreYouSure({ x: announcement.title }),
	}).then(({ canceled }) => {
		if (canceled) return;
		announcements.value = announcements.value.filter(x => x !== announcement);
		misskeyApi('admin/announcements/delete', announcement);
	});
}

async function archive(announcement) {
	await os.apiWithDialog('admin/announcements/update', {
		...announcement,
		isActive: false,
	});
	refresh();
}

async function unarchive(announcement) {
	await os.apiWithDialog('admin/announcements/update', {
		...announcement,
		isActive: true,
	});
	refresh();
}

async function save(announcement): Promise<void> {
	if (announcement.id == null) {
		await os.apiWithDialog('admin/announcements/create', announcement);
	} else {
		await os.apiWithDialog('admin/announcements/update', announcement);
	}
	refresh();
}

async function fetch(resetOffset = false): Promise<void> {
	// Prevent duplicate requests
	if (fetching.value) return;

	fetching.value = true;
	const currentSequence = ++fetchSequence;

	try {
		if (resetOffset) {
			announcements.value = [];
			offset.value = 0;
			hasMore.value = false;
			loading.value = true;
		}

		const params: any = {
			offsetMode: true,
			offset: offset.value,
			limit: 10,
			status: announcementsStatus.value,
		};

		if (user.value?.id) {
			params.userId = user.value.id;
		}

		const announcementResponse = await misskeyApi('admin/announcements/list', params);

		// Check if this is still the latest request
		if (currentSequence !== fetchSequence) return;

		if (resetOffset) {
			announcements.value = announcementResponse;
		} else {
			announcements.value = announcements.value.concat(announcementResponse);
		}
		hasMore.value = announcementResponse?.length === 10;
		offset.value += announcementResponse?.length ?? 0;
	} catch (error) {
		console.error('Failed to fetch announcements:', error);
		if (currentSequence === fetchSequence) {
			os.alert({
				type: 'error',
				title: 'エラー',
				text: 'お知らせの取得に失敗しました。',
			});
		}
	} finally {
		if (currentSequence === fetchSequence) {
			loading.value = false;
			fetching.value = false;
		}
	}
}

async function refresh(): Promise<void> {
	await fetch(true);
}

watch(user, () => refresh());

const headerActions = computed(() => [{
	asFullButton: true,
	icon: 'ti ti-plus',
	text: i18n.ts.add,
	handler: add,
	disabled: announcementsStatus.value === 'archived',
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.announcements,
	icon: 'ti ti-speakerphone',
}));
</script>

<style lang="scss" module>
.more {
	margin-left: auto;
	margin-right: auto;
}
</style>
