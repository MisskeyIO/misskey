<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialog"
	:width="400"
	@close="dialog?.close()"
	@closed="emit('closed')"
>
	<template v-if="announcement" #header>:{{ announcement.title }}:</template>
	<template v-else #header>New announcement</template>

	<div>
		<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 28px;">
			<div class="_gaps_m">
				<MkInput v-model="title">
					<template #label>{{ i18n.ts.title }}</template>
				</MkInput>
				<MkTextarea v-model="text">
					<template #label>{{ i18n.ts.text }}</template>
				</MkTextarea>
				<MkRadios
					v-model="icon"
					:options="[
						{ value: 'info', icon: 'ti ti-info-circle' },
						{ value: 'warning', icon: 'ti ti-alert-triangle', iconStyle: 'color: var(--MI_THEME-warn);' },
						{ value: 'error', icon: 'ti ti-circle-x', iconStyle: 'color: var(--MI_THEME-error);' },
						{ value: 'success', icon: 'ti ti-check', iconStyle: 'color: var(--MI_THEME-success);' },
					]"
				>
					<template #label>{{ i18n.ts.icon }}</template>
				</MkRadios>
				<MkRadios
					v-model="display"
					:options="[
						{ value: 'normal', label: i18n.ts.normal },
						{ value: 'banner', label: i18n.ts.banner },
						{ value: 'dialog', label: i18n.ts.dialog },
					]"
				>
					<template #label>{{ i18n.ts.display }}</template>
				</MkRadios>
				<MkSwitch v-model="needConfirmationToRead">
					{{ i18n.ts._announcement.needConfirmationToRead }}
					<template #caption>{{ i18n.ts._announcement.needConfirmationToReadDescription }}</template>
				</MkSwitch>
				<MkSwitch v-model="needEnrollmentTutorialToRead">
					{{ i18n.ts._announcement.needEnrollmentTutorialToRead }}
					<template #caption>{{ i18n.ts._announcement.needEnrollmentTutorialToReadDescription }}</template>
				</MkSwitch>
				<MkInput v-model="closeDuration" type="number" :min="0">
					<template #label>{{ i18n.ts._announcement.closeDuration }}</template>
					<template #caption>{{ i18n.ts._announcement.closeDurationDescription }}</template>
				</MkInput>
				<MkInput v-model="displayOrder" type="number">
					<template #label>{{ i18n.ts._announcement.displayOrder }}</template>
					<template #caption>{{ i18n.ts._announcement.displayOrderDescription }}</template>
				</MkInput>
				<MkButton v-if="announcement" danger @click="del()"><i class="ti ti-trash"></i> {{ i18n.ts.delete }}</MkButton>
			</div>
		</div>
		<div :class="$style.footer">
			<MkButton primary rounded style="margin: 0 auto;" @click="done"><i class="ti ti-check"></i> {{ props.announcement ? i18n.ts.update : i18n.ts.create }}</MkButton>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import MkTextarea from '@/components/MkTextarea.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkRadios from '@/components/MkRadios.vue';

type AnnouncementGateFields = {
	closeDuration?: number | null;
	displayOrder?: number;
	needEnrollmentTutorialToRead?: boolean;
};
type AnnouncementEditPayload = Misskey.entities.AdminAnnouncementsCreateRequest & {
	closeDuration: number;
	displayOrder: number;
	needEnrollmentTutorialToRead: boolean;
};
type AdminAnnouncementType = Misskey.entities.AdminAnnouncementsCreateRequest & AnnouncementGateFields & { id: string; };

const props = defineProps<{
	user: Misskey.entities.User,
	announcement?: AdminAnnouncementType,
}>();

const emit = defineEmits<{
	(ev: 'done', v: { deleted?: boolean; updated?: AdminAnnouncementType; created?: AdminAnnouncementType; }): void,
	(ev: 'closed'): void
}>();

const dialog = useTemplateRef('dialog');
const title = ref(props.announcement ? props.announcement.title : '');
const text = ref(props.announcement ? props.announcement.text : '');
const icon = ref<Misskey.entities.Announcement['icon']>(props.announcement?.icon ?? 'info');
const display = ref<Misskey.entities.Announcement['display']>(props.announcement?.display ?? 'dialog');
const needConfirmationToRead = ref<boolean>(props.announcement?.needConfirmationToRead ?? false);
const needEnrollmentTutorialToRead = ref<boolean>(props.announcement?.needEnrollmentTutorialToRead ?? false);
const closeDuration = ref(props.announcement?.closeDuration ?? 0);
const displayOrder = ref(props.announcement?.displayOrder ?? 0);

async function done() {
	const params = {
		title: title.value,
		text: text.value,
		icon: icon.value,
		imageUrl: null,
		display: display.value,
		needConfirmationToRead: needConfirmationToRead.value,
		needEnrollmentTutorialToRead: needEnrollmentTutorialToRead.value,
		closeDuration: closeDuration.value,
		displayOrder: displayOrder.value,
		userId: props.user.id,
	} satisfies AnnouncementEditPayload;

	if (props.announcement) {
		await os.apiWithDialog('admin/announcements/update', {
			...params,
			id: props.announcement.id,
		});

		emit('done', {
			updated: {
				...params,
				id: props.announcement.id,
			},
		});

		dialog.value?.close();
	} else {
		const created = await os.apiWithDialog('admin/announcements/create', params);

		emit('done', {
			created: created,
		});

		dialog.value?.close();
	}
}

async function del() {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx.removeAreYouSure({ x: title.value }),
	});
	if (canceled) return;

	if (props.announcement) {
		await misskeyApi('admin/announcements/delete', {
			id: props.announcement.id,
		});
	}

	emit('done', {
		deleted: true,
	});
	dialog.value?.close();
}
</script>

<style lang="scss" module>
.footer {
	position: sticky;
	bottom: 0;
	left: 0;
	padding: 12px;
	border-top: solid 0.5px var(--MI_THEME-divider);
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
}
</style>
