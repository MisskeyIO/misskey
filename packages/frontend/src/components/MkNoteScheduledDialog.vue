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
		{{ i18n.ts._drafts.listScheduledNotes }}
	</template>

	<div class="_spacer">
		<MkPagination :paginator="scheduledPaginator" withControl>
			<template #empty>
				<MkResult type="empty" :text="i18n.ts.nothing"/>
			</template>

			<template #default="{ items }">
				<div class="_gaps_s">
					<div
						v-for="scheduled in (items as any[])"
						:key="scheduled.id"
						v-panel
						:class="[$style.draft]"
					>
						<div :class="$style.draftBody" class="_gaps_s">
							<MkInfo v-if="scheduled.scheduledAt != null">
								<I18n :src="i18n.ts.scheduledToPostOnX" tag="span">
									<template #x>
										<MkTime :time="scheduled.scheduledAt" :mode="'detail'" style="font-weight: bold;"/>
									</template>
								</I18n>
							</MkInfo>
							<MkInfo v-if="scheduled.reason" warn>
								{{ i18n.ts.error }}: {{ scheduled.reason }}
							</MkInfo>
							<div :class="$style.draftInfo">
								<div :class="$style.draftMeta">
									<div v-if="scheduled.reply" class="_nowrap">
										<i class="ti ti-arrow-back-up"></i> <I18n :src="i18n.ts._drafts.replyTo" tag="span">
											<template #user>
												<Mfm v-if="scheduled.reply.user.name != null" :text="scheduled.reply.user.name" :plain="true" :nowrap="true"/>
												<MkAcct v-else :user="scheduled.reply.user"/>
											</template>
										</I18n>
									</div>
									<div v-if="scheduled.renote" class="_nowrap">
										<i class="ti ti-quote"></i> <I18n :src="i18n.ts._drafts.quoteOf" tag="span">
											<template #user>
												<Mfm v-if="scheduled.renote.user.name != null" :text="scheduled.renote.user.name" :plain="true" :nowrap="true"/>
												<MkAcct v-else :user="scheduled.renote.user"/>
											</template>
										</I18n>
									</div>
									<div v-if="scheduled.channel" class="_nowrap">
										<i class="ti ti-device-tv"></i> {{ i18n.tsx._drafts.postTo({ channel: scheduled.channel.name }) }}
									</div>
								</div>
							</div>
							<div :class="$style.draftContent">
								<Mfm :text="getNoteSummary({ ...scheduled.data, renote: scheduled.renote, reply: scheduled.reply }, { showRenote: false, showReply: false })" :plain="true"/>
							</div>
							<div :class="$style.draftFooter">
								<div :class="$style.draftVisibility">
									<span :title="i18n.ts._visibility[scheduled.data.visibility]">
										<i v-if="scheduled.data.visibility === 'public'" class="ti ti-world"></i>
										<i v-else-if="scheduled.data.visibility === 'home'" class="ti ti-home"></i>
										<i v-else-if="scheduled.data.visibility === 'followers'" class="ti ti-lock"></i>
										<i v-else-if="scheduled.data.visibility === 'specified'" class="ti ti-mail"></i>
									</span>
									<span v-if="scheduled.data.localOnly" :title="i18n.ts._visibility['disableFederation']"><i class="ti ti-rocket-off"></i></span>
								</div>
								<MkTime :time="scheduled.createdAt" :class="$style.draftCreatedAt" mode="detail" colored/>
							</div>
						</div>

						<div :class="$style.draftActions" class="_buttons">
							<MkButton
								:class="$style.itemButton"
								small
								@click="cancelSchedule(scheduled)"
							>
								<i class="ti ti-calendar-x"></i> {{ i18n.ts._drafts.cancelSchedule }}
							</MkButton>
							<MkButton
								v-tooltip="i18n.ts.delete"
								danger
								small
								:iconOnly="true"
								:class="$style.itemButton"
								style="margin-left: auto;"
								@click="deleteScheduledNote(scheduled)"
							>
								<i class="ti ti-trash"></i>
							</MkButton>
						</div>
					</div>
				</div>
			</template>
		</MkPagination>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { shallowRef, markRaw } from 'vue';
import * as Misskey from 'misskey-js';
import MkButton from '@/components/MkButton.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkInfo from '@/components/MkInfo.vue';
import { getNoteSummary } from '@/utility/get-note-summary.js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { Paginator } from '@/utility/paginator.js';

const emit = defineEmits<{
	(ev: 'cancel'): void;
	(ev: 'closed'): void;
}>();

const scheduledPaginator = markRaw(new Paginator('notes/scheduled/list', {
	limit: 10,
	offsetMode: true,
}));

const dialogEl = shallowRef<InstanceType<typeof MkModalWindow>>();

function cancel() {
	emit('cancel');
	dialogEl.value?.close();
}

async function cancelSchedule(draft: any) {
	os.apiWithDialog('notes/scheduled/cancel', {
		draftId: draft.id,
	}).then(() => {
		scheduledPaginator.reload();
	});
}

async function deleteScheduledNote(draft: any) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.ts.deleteAreYouSure.replace('{x}', getNoteSummary({ ...draft.data, renote: draft.renote, reply: draft.reply }, { showRenote: false, showReply: false })),
	});

	if (canceled) return;

	os.apiWithDialog('notes/scheduled/cancel', { draftId: draft.id }).then(() => {
		scheduledPaginator.reload();
	});
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
</style>
