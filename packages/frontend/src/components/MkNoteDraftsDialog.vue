<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialogEl"
	:width="600"
	:height="650"
	:withOkButton="false"
	@click="cancel()"
	@close="cancel()"
	@closed="emit('closed')"
	@esc="cancel()"
>
	<template #header>
		{{ i18n.ts.draftsAndScheduledNotes }} ({{ currentDraftsCount }}/{{ $i?.policies.noteDraftLimit }})
	</template>

	<MkStickyContainer>
		<template #header>
			<MkTabs
				v-model:tab="tab"
				centered
				:class="$style.tabs"
				:tabs="[
					{
						key: 'drafts',
						title: i18n.ts.drafts,
						icon: 'ti ti-pencil-question',
					},
					{
						key: 'scheduled',
						title: i18n.ts.scheduled,
						icon: 'ti ti-calendar-clock',
					},
					...(hasLegacyDrafts ? [{
						key: 'legacy',
						title: i18n.ts._drafts.legacy,
						icon: 'ti ti-device-floppy',
					}] : []),
				]"
			/>
		</template>

		<div v-if="tab !== 'legacy'" class="_spacer">
			<MkPagination :key="tab" :paginator="tab === 'scheduled' ? scheduledPaginator : draftsPaginator" withControl>
				<template #empty>
					<MkResult type="empty" :text="i18n.ts._drafts.noDrafts"/>
				</template>

				<template #default="{ items }">
					<div class="_gaps_s">
						<div
							v-for="draft in (items as unknown as Misskey.entities.NoteDraft[])"
							:key="draft.id"
							v-panel
							:class="[$style.draft]"
						>
							<div :class="$style.draftBody" class="_gaps_s">
								<MkInfo v-if="draft.scheduledAt != null && draft.isActuallyScheduled">
									<I18n :src="i18n.ts.scheduledToPostOnX" tag="span">
										<template #x>
											<MkTime :time="draft.scheduledAt" :mode="'detail'" style="font-weight: bold;"/>
										</template>
									</I18n>
								</MkInfo>
								<MkInfo v-if="draft.scheduledFailureReason != null" warn>
									<div>{{ i18n.ts._drafts.scheduledPostFailed }}</div>
									<div v-if="draft.scheduledAt != null">
										{{ i18n.ts._drafts.originalScheduledAt }}: <MkTime :time="draft.scheduledAt" mode="detail"/>
									</div>
								</MkInfo>
								<div :class="$style.draftInfo">
									<div :class="$style.draftMeta">
										<div v-if="draft.reply" class="_nowrap">
											<i class="ti ti-arrow-back-up"></i> <I18n :src="i18n.ts._drafts.replyTo" tag="span">
												<template #user>
													<Mfm v-if="draft.reply.user.name != null" :text="draft.reply.user.name" :plain="true" :nowrap="true"/>
													<MkAcct v-else :user="draft.reply.user"/>
												</template>
											</I18n>
										</div>
										<div v-else-if="draft.replyId" class="_nowrap">
											<i class="ti ti-arrow-back-up"></i> <I18n :src="i18n.ts._drafts.replyTo" tag="span">
												<template #user>
													{{ i18n.ts.deletedNote }}
												</template>
											</I18n>
										</div>
										<div v-if="draft.renote && draft.text != null" class="_nowrap">
											<i class="ti ti-quote"></i> <I18n :src="i18n.ts._drafts.quoteOf" tag="span">
												<template #user>
													<Mfm v-if="draft.renote.user.name != null" :text="draft.renote.user.name" :plain="true" :nowrap="true"/>
													<MkAcct v-else :user="draft.renote.user"/>
												</template>
											</I18n>
										</div>
										<div v-else-if="draft.renoteId" class="_nowrap">
											<i class="ti ti-quote"></i> <I18n :src="i18n.ts._drafts.quoteOf" tag="span">
												<template #user>
													{{ i18n.ts.deletedNote }}
												</template>
											</I18n>
										</div>
										<div v-if="draft.channel" class="_nowrap">
											<i class="ti ti-device-tv"></i> {{ i18n.tsx._drafts.postTo({ channel: draft.channel.name }) }}
										</div>
									</div>
								</div>
								<div :class="$style.draftContent">
									<Mfm :text="getNoteSummary(draft, { showRenote: false, showReply: false })" :plain="true" :author="draft.user"/>
								</div>
								<div :class="$style.draftFooter">
									<div :class="$style.draftVisibility">
										<span :title="i18n.ts._visibility[draft.visibility]">
											<i v-if="draft.visibility === 'public'" class="ti ti-world"></i>
											<i v-else-if="draft.visibility === 'home'" class="ti ti-home"></i>
											<i v-else-if="draft.visibility === 'followers'" class="ti ti-lock"></i>
											<i v-else-if="draft.visibility === 'specified'" class="ti ti-mail"></i>
										</span>
										<span v-if="draft.localOnly" :title="i18n.ts._visibility['disableFederation']"><i class="ti ti-rocket-off"></i></span>
										<span v-if="typeof draft.dimension === 'number' && draft.dimension > 0" :title="i18n.tsx.dimensionWithNumber({ dimension: draft.dimension })"><i class="ti ti-cube"></i> {{ draft.dimension }}</span>
										<span v-if="draft.lang" :title="getLangTitle(draft.lang)"><i class="ti ti-language"></i> {{ draft.lang }}</span>
									</div>
									<MkTime :time="draft.createdAt" :class="$style.draftCreatedAt" mode="detail" colored/>
								</div>
							</div>

							<div :class="$style.draftActions" class="_buttons">
								<template v-if="draft.scheduledAt != null && draft.isActuallyScheduled">
									<MkButton
										:class="$style.itemButton"
										small
										@click="cancelSchedule(draft)"
									>
										<i class="ti ti-calendar-x"></i> {{ i18n.ts._drafts.cancelSchedule }}
									</MkButton>
									<!-- TODO
									<MkButton
										:class="$style.itemButton"
										small
										@click="reSchedule(draft)"
									>
										<i class="ti ti-calendar-time"></i> {{ i18n.ts._drafts.reSchedule }}
									</MkButton>
									-->
								</template>
								<MkButton
									v-else
									:class="$style.itemButton"
									small
									@click="restoreDraft(draft)"
								>
									<i class="ti ti-corner-up-left"></i> {{ i18n.ts._drafts.restore }}
								</MkButton>
								<MkButton
									v-tooltip="i18n.ts._drafts.delete"
									danger
									small
									:iconOnly="true"
									:class="$style.itemButton"
									style="margin-left: auto;"
									@click="deleteDraft(draft)"
								>
									<i class="ti ti-trash"></i>
								</MkButton>
							</div>
						</div>
					</div>
				</template>
			</MkPagination>
		</div>

		<div v-else class="_spacer _gaps_m">
			<div :class="$style.account">
				<MkAvatar v-if="$i" :user="$i" :class="$style.avatar"/>
				<div>
					<div class="_caption">{{ i18n.ts._drafts.legacyAccount }}</div>
					<MkAcct v-if="$i" :user="$i" detail/>
				</div>
			</div>
			<div>{{ i18n.ts._drafts.legacyDescription }}</div>
			<MkInfo v-if="legacyParseFailed || legacyInvalidCount > 0" warn>{{ i18n.ts._drafts.legacyDataBroken }}</MkInfo>
			<MkResult v-if="legacyEntries.length === 0 && !legacyParseFailed && legacyInvalidCount === 0" type="empty" :text="i18n.ts._drafts.noDrafts"/>
			<div class="_gaps_s">
				<div v-for="entry in legacyEntries" :key="entry.key" v-panel :class="$style.draft">
					<div :class="$style.draftBody" class="_gaps_s">
						<div :class="$style.draftContent"><Mfm :text="legacySummary(entry.draft)" :plain="true"/></div>
						<div :class="$style.draftFooter">
							<div :class="$style.draftVisibility">
								<span v-if="entry.draft.channel"><i class="ti ti-device-tv"></i> {{ entry.draft.channel.name }}</span>
								<span v-if="typeof entry.draft.data.dimension === 'number' && entry.draft.data.dimension > 0"><i class="ti ti-cube"></i> {{ entry.draft.data.dimension }}</span>
								<span v-if="entry.draft.data.lang"><i class="ti ti-language"></i> {{ entry.draft.data.lang }}</span>
							</div>
							<MkTime :time="entry.draft.updatedAt" :class="$style.draftCreatedAt" mode="detail" colored/>
						</div>
					</div>
					<div :class="$style.draftActions" class="_buttons">
						<MkButton primary small @click="migrateLegacyDraft(entry)"><i class="ti ti-cloud-upload"></i> {{ i18n.ts._drafts.migrate }}</MkButton>
					</div>
				</div>
			</div>
		</div>
	</MkStickyContainer>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { computed, ref, shallowRef, markRaw } from 'vue';
import * as Misskey from 'misskey-js';
import MkButton from '@/components/MkButton.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import { getNoteSummary } from '@/utility/get-note-summary.js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { $i } from '@/i.js';
import { miLocalStorage } from '@/local-storage.js';
import { langmap } from '@/utility/langmap.js';
import { legacyNoteDraftToRequest, parseLegacyNoteDrafts, removeUnchangedLegacyNoteDraft } from '@/utility/note-draft-migration.js';
import type { LegacyNoteDraft, LegacyNoteDraftEntry } from '@/utility/note-draft-migration.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { Paginator } from '@/utility/paginator.js';
import MkTabs from '@/components/MkTabs.vue';
import MkInfo from '@/components/MkInfo.vue';

const props = defineProps<{
	scheduled?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'restore', draft: Misskey.entities.NoteDraft): void;
	(ev: 'cancel'): void;
	(ev: 'closed'): void;
}>();

const tab = ref<'drafts' | 'scheduled' | 'legacy'>(props.scheduled ? 'scheduled' : 'drafts');

const legacyEntries = ref<LegacyNoteDraftEntry[]>([]);
const legacyInvalidCount = ref(0);
const legacyParseFailed = ref(false);
const hasLegacyDrafts = computed(() => legacyEntries.value.length > 0 || legacyInvalidCount.value > 0 || legacyParseFailed.value);

function loadLegacyDrafts() {
	const result = parseLegacyNoteDrafts(miLocalStorage.getItem('drafts'));
	legacyEntries.value = result.entries;
	legacyInvalidCount.value = result.invalidCount;
	legacyParseFailed.value = result.parseFailed;
}

loadLegacyDrafts();

const draftsPaginator = markRaw(new Paginator('notes/drafts/list', {
	limit: 10,
	params: {
		scheduled: false,
	},
}));

const scheduledPaginator = markRaw(new Paginator('notes/drafts/list', {
	limit: 10,
	params: {
		scheduled: true,
	},
}));

const currentDraftsCount = ref(0);

async function reloadDraftCount() {
	const count = await misskeyApi('notes/drafts/count');
	currentDraftsCount.value = count;
}

void reloadDraftCount();

const dialogEl = shallowRef<InstanceType<typeof MkModalWindow>>();

function cancel() {
	emit('cancel');
	dialogEl.value?.close();
}

function restoreDraft(draft: Misskey.entities.NoteDraft) {
	emit('restore', draft);
	dialogEl.value?.close();
}

async function deleteDraft(draft: Misskey.entities.NoteDraft) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.ts._drafts.deleteAreYouSure,
	});

	if (canceled) return;

	try {
		await os.apiWithDialog('notes/drafts/delete', { draftId: draft.id });
	} catch {
		return;
	}

	(tab.value === 'scheduled' ? scheduledPaginator : draftsPaginator).reload();
	await reloadDraftCount();
}

async function cancelSchedule(draft: Misskey.entities.NoteDraft) {
	await os.apiWithDialog('notes/drafts/update', {
		draftId: draft.id,
		isActuallyScheduled: false,
		scheduledAt: null,
	});
	scheduledPaginator.reload();
}

function getLangTitle(lang: string): string {
	const label = lang === 'other' ? i18n.ts.other : langmap[lang]?.nativeName ?? lang;
	return `${i18n.ts.postingLanguage}: ${label}`;
}

function legacySummary(draft: LegacyNoteDraft): string {
	return draft.data.cw ?? draft.data.text ?? i18n.ts.nothing;
}

async function migrateLegacyDraft(entry: LegacyNoteDraftEntry) {
	if ($i == null) return;
	const account = Misskey.acct.toString($i);
	const { canceled } = await os.confirm({
		type: 'question',
		text: i18n.tsx._drafts.migrateConfirm({ account }),
	});
	if (canceled) return;

	let request: Misskey.Endpoints['notes/drafts/create']['req'];
	try {
		request = legacyNoteDraftToRequest(entry.draft);
	} catch {
		await os.alert({ type: 'error', text: i18n.ts._drafts.legacyDataBroken });
		return;
	}

	try {
		await os.apiWithDialog('notes/drafts/create', request);
	} catch {
		return;
	}

	const updated = removeUnchangedLegacyNoteDraft(miLocalStorage.getItem('drafts'), entry.key, entry.fingerprint);
	if (updated == null) {
		await os.alert({ type: 'warning', text: i18n.ts._drafts.legacyChanged });
	} else {
		miLocalStorage.setItem('drafts', updated);
	}

	loadLegacyDrafts();
	draftsPaginator.reload();
	await reloadDraftCount();
	tab.value = 'drafts';
	os.success();
}
</script>

<style lang="scss" module>
.draft {
	padding: 16px;
	gap: 16px;
	border-radius: 10px;
}

.draftBody {
	width: 100%;
	min-width: 0;
}

.draftInfo {
	display: flex;
	width: 100%;
	font-size: 0.85em;
	opacity: 0.7;
}

.draftMeta {
	flex-grow: 1;
	min-width: 0;
}

.draftContent {
	display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
	line-clamp: 2;
  overflow: hidden;
	font-size: 0.9em;
}

.draftFooter {
	display: flex;
	align-items: center;
	gap: 8px;
}

.draftVisibility {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	flex-shrink: 0;
}

.draftCreatedAt {
	font-size: 85%;
	opacity: 0.7;
}

.draftActions {
	margin-top: 16px;
	padding-top: 16px;
	border-top: solid 1px var(--MI_THEME-divider);
}

.tabs {
	background: color(from var(--MI_THEME-bg) srgb r g b / 0.75);
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
	border-bottom: solid 0.5px var(--MI_THEME-divider);
}

.account {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 10px;
}

.avatar {
	width: 40px;
	height: 40px;
}
</style>
