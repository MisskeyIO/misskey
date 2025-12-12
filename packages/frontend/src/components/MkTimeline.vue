<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkPullToRefresh ref="prComponent" :refresher="() => reloadTimeline()">
	<MkPagination
		v-if="paginationQuery" ref="pagingComponent" :pagination="paginationQuery"
		@queue="emit('queue', $event)" @status="prComponent?.setDisabled($event)"
	>
		<template #empty>
			<div class="_fullinfo">
				<img :src="infoImageUrl" draggable="false"/>
				<div>{{ i18n.ts.noNotes }}</div>
			</div>
		</template>

		<template #default="{ items: notes }">
			<component
				:is="prefer.s.animation ? TransitionGroup : 'div'"
				:class="[$style.root, { [$style.noGap]: noGap, '_gaps': !noGap, [$style.reverse]: paginationQuery.prepend }]"
				:enterActiveClass="$style.transition_x_enterActive"
				:leaveActiveClass="$style.transition_x_leaveActive"
				:enterFromClass="$style.transition_x_enterFrom"
				:leaveToClass="$style.transition_x_leaveTo"
				:moveClass=" $style.transition_x_move"
				tag="div"
			>
				<template v-for="(note, i) in (notes as Misskey.entities.Note[])" :key="note.id">
					<div
						v-if="note['_isBufferedMarker_']"
						:class="[$style.gapMarker, $style.note, { '_gaps': !noGap }]"
						:data-scroll-anchor="note.id"
					>
						<span aria-hidden="true">⋮</span>
					</div>
					<div
						v-else-if="note['_shouldInsertAd_']" :class="[$style.noteWithAd, { '_gaps': !noGap }]"
						:data-scroll-anchor="note.id"
					>
						<MkNote :class="$style.note" :note="note" :withHardMute="true"/>
						<div :class="$style.ad">
							<MkAd :preferForms="['horizontal', 'horizontal-big']"/>
						</div>
					</div>
					<MkNote v-else :class="$style.note" :note="note" :withHardMute="true" :data-scroll-anchor="note.id"/>
				</template>
			</component>
		</template>
	</MkPagination>
</MkPullToRefresh>
</template>

<script lang="ts" setup>
import { computed, watch, onUnmounted, provide, useTemplateRef, TransitionGroup, onMounted } from 'vue';
import * as Misskey from 'misskey-js';
import type { Paging } from '@/components/MkPagination.vue';
import type { AllTimelineType, TimelinePageSrc } from '@/timelines.js';
import { allTimelineTypes } from '@/timelines.js';
import MkPullToRefresh from '@/components/MkPullToRefresh.vue';
import { useStream } from '@/stream.js';
import * as sound from '@/utility/sound.js';
import { deepMerge } from '@/utility/merge.js';
import { $i } from '@/i.js';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';
import MkNote from '@/components/MkNote.vue';
import MkPagination from '@/components/MkPagination.vue';
import { i18n } from '@/i18n.js';
import { infoImageUrl } from '@/instance.js';
import { generateClientTransactionId } from '@/utility/misskey-api.js';

const props = withDefaults(defineProps<{
	src: TimelinePageSrc | AllTimelineType;
	list?: string;
	antenna?: string;
	channel?: string;
	role?: string;
	sound?: boolean;
	withRenotes?: boolean;
	withReplies?: boolean;
	withSensitive?: boolean;
	onlyFiles?: boolean;
}>(), {
	withRenotes: true,
	withReplies: false,
	withSensitive: true,
	onlyFiles: false,
});

const emit = defineEmits<{
	(ev: 'note'): void;
	(ev: 'queue', count: number): void;
}>();

provide('inTimeline', true);
provide('tl_withSensitive', computed(() => props.withSensitive));
provide('inChannel', computed(() => props.src === 'channel'));

type TimelineQueryType = {
	antennaId?: string,
	withRenotes?: boolean,
	withReplies?: boolean,
	withFiles?: boolean,
	visibility?: string,
	listId?: string,
	channelId?: string,
	roleId?: string
};

const prComponent = useTemplateRef('prComponent');
const pagingComponent = useTemplateRef('pagingComponent');

let tlNotesCount = 0;
const notVisibleNoteData = new Array<object>();

async function fulfillNoteData(data) {
	// チェックするプロパティはなんでも良い
	// minimizeが有効でid以外が存在しない場合は取得する
	if (!data.visibility) {
		const res = await window.fetch(`/notes/${data.id}.json`, {
			method: 'GET',
			credentials: 'include',
			headers: {
				'Authorization': 'anonymous',
				'X-Client-Transaction-Id': generateClientTransactionId('misskey'),
			},
		});
		if (!res.ok) return null;
		return deepMerge(data, await res.json());
	}

	return data;
}

async function prepend(data) {
	if (pagingComponent.value == null) return;

	let note = data;

	if (!window.document.hidden) {
		note = await fulfillNoteData(data);
		if (note == null) return;

		tlNotesCount++;

		if (instance.notesPerOneAd > 0 && tlNotesCount % instance.notesPerOneAd === 0) {
			note._shouldInsertAd_ = true;
		}

		pagingComponent.value.prepend(note);
	} else {
		notVisibleNoteData.push(data);

		if (notVisibleNoteData.length > 10) {
			notVisibleNoteData.shift();
		}
	}

	emit('note');

	if (props.sound) {
		sound.playMisskeySfx($i && (note.userId === $i.id) ? 'noteMy' : 'note');
	}
}

async function loadUnloadedNotes() {
	if (window.document.hidden) return;
	if (pagingComponent.value == null) return;
	if (notVisibleNoteData.length === 0) return;

	pagingComponent.value.stopFetch();
	try {
		const items = [...notVisibleNoteData];
		notVisibleNoteData.length = 0;

		const notes = await Promise.allSettled(items.map(fulfillNoteData));
		const fulfilledNotes = notes
			.filter((i): i is PromiseFulfilledResult<object> => i.status === 'fulfilled' && i.value != null)
			.map(i => i.value);
		if (fulfilledNotes.length === 0) return;

		if (items.length >= 10) {
			if (pagingComponent.value.isHead?.() ?? true) {
				pagingComponent.value.deleteItem();
			} else {
				pagingComponent.value.prepend({
					id: `buffer-marker-${Date.now()}`,
					_isBufferedMarker_: true,
				} as never);
			}
		}

		for (const note of fulfilledNotes) await prepend(note);
	} finally {
		pagingComponent.value.startFetch();
	}
}

let connection: Misskey.IChannelConnection<any> | null = null;
let connection2: Misskey.IChannelConnection<any> | null = null;
let paginationQuery: Paging | null = null;
const noGap = !prefer.s.showGapBetweenNotesInTimeline;

const stream = useStream();

function connectChannel() {
	if (props.src === 'antenna') {
		if (props.antenna == null) return;
		connection = stream.useChannel('antenna', {
			antennaId: props.antenna,
			minimize: true,
		});
	} else if (props.src === 'home') {
		connection = stream.useChannel('homeTimeline', {
			withRenotes: props.withRenotes,
			withFiles: props.onlyFiles ? true : undefined,
			minimize: true,
		});
		connection2 = stream.useChannel('main');
	} else if (props.src === 'local') {
		connection = stream.useChannel('localTimeline', {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: props.onlyFiles ? true : undefined,
			minimize: true,
		});
	} else if (props.src === 'media') {
		connection = stream.useChannel('hybridTimeline', {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: true,
			minimize: true,
		});
	} else if (props.src === 'social') {
		connection = stream.useChannel('hybridTimeline', {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: props.onlyFiles ? true : undefined,
			minimize: true,
		});
	} else if (props.src === 'global') {
		connection = stream.useChannel('globalTimeline', {
			withRenotes: props.withRenotes,
			withFiles: props.onlyFiles ? true : undefined,
			minimize: true,
		});
	} else if (props.src === 'mentions') {
		connection = stream.useChannel('main');
		connection.on('mention', prepend);
	} else if (props.src === 'directs') {
		const onNote = note => {
			if (note.visibility === 'specified') {
				prepend(note);
			}
		};
		connection = stream.useChannel('main');
		connection.on('mention', onNote);
	} else if (props.src === 'list') {
		if (props.list == null) return;
		connection = stream.useChannel('userList', {
			withRenotes: props.withRenotes,
			withFiles: props.onlyFiles ? true : undefined,
			listId: props.list,
			minimize: true,
		});
	} else if (props.src === 'channel') {
		if (props.channel == null) return;
		connection = stream.useChannel('channel', {
			channelId: props.channel,
			minimize: true,
		});
	} else if (props.src === 'role') {
		if (props.role == null) return;
		connection = stream.useChannel('roleTimeline', {
			roleId: props.role,
			minimize: true,
		});
	}
	if (props.src !== 'directs' && props.src !== 'mentions') connection?.on('note', prepend);
}

function disconnectChannel() {
	if (connection) connection.dispose();
	if (connection2) connection2.dispose();
}

function updatePaginationQuery() {
	let endpoint: keyof Misskey.Endpoints | null;
	let query: TimelineQueryType | null;

	if (props.src === 'antenna') {
		endpoint = 'antennas/notes';
		query = {
			antennaId: props.antenna,
		};
	} else if (props.src === 'home') {
		endpoint = 'notes/timeline';
		query = {
			withRenotes: props.withRenotes,
			withFiles: props.onlyFiles ? true : undefined,
		};
	} else if (props.src === 'local') {
		endpoint = 'notes/local-timeline';
		query = {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: props.onlyFiles ? true : undefined,
		};
	} else if (props.src === 'media') {
		endpoint = 'notes/hybrid-timeline';
		query = {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: true,
		};
	} else if (props.src === 'social') {
		endpoint = 'notes/hybrid-timeline';
		query = {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: props.onlyFiles ? true : undefined,
		};
	} else if (props.src === 'global') {
		endpoint = 'notes/global-timeline';
		query = {
			withRenotes: props.withRenotes,
			withFiles: props.onlyFiles ? true : undefined,
		};
	} else if (props.src === 'mentions') {
		endpoint = 'notes/mentions';
		query = null;
	} else if (props.src === 'directs') {
		endpoint = 'notes/mentions';
		query = {
			visibility: 'specified',
		};
	} else if (props.src === 'list') {
		endpoint = 'notes/user-list-timeline';
		query = {
			withRenotes: props.withRenotes,
			withFiles: props.onlyFiles ? true : undefined,
			listId: props.list,
		};
	} else if (props.src === 'channel') {
		endpoint = 'channels/timeline';
		query = {
			channelId: props.channel,
		};
	} else if (props.src === 'role') {
		endpoint = 'roles/notes';
		query = {
			roleId: props.role,
		};
	} else {
		endpoint = null;
		query = null;
	}

	if (endpoint && query) {
		paginationQuery = {
			endpoint: endpoint,
			limit: 10,
			params: query,
		};
	} else {
		paginationQuery = null;
	}
}

function refreshEndpointAndChannel() {
	if (!prefer.s.disableStreamingTimeline) {
		disconnectChannel();
		connectChannel();
	}

	updatePaginationQuery();
}

// デッキのリストカラムでwithRenotesを変更した場合に自動的に更新されるようにさせる
// IDが切り替わったら切り替え先のTLを表示させたい
watch(() => [props.list, props.antenna, props.channel, props.role, props.withRenotes], refreshEndpointAndChannel);

// withSensitiveはクライアントで完結する処理のため、単にリロードするだけでOK
watch(() => props.withSensitive, reloadTimeline);

// 初回表示用
refreshEndpointAndChannel();

onMounted(() => {
	window.document.addEventListener('visibilitychange', loadUnloadedNotes);
});

onUnmounted(() => {
	disconnectChannel();
	window.document.removeEventListener('visibilitychange', loadUnloadedNotes);
});

function reloadTimeline() {
	return new Promise<void>((res) => {
		if (pagingComponent.value == null) return;

		tlNotesCount = 0;

		pagingComponent.value.reload().then(() => {
			res();
		});
	});
}

defineExpose({
	reloadTimeline,
});
</script>

<style lang="scss" module>
.transition_x_move,
.transition_x_enterActive,
.transition_x_leaveActive {
	transition: opacity 0.3s cubic-bezier(0, .5, .5, 1), transform 0.3s cubic-bezier(0, .5, .5, 1) !important;
}

.transition_x_enterFrom,
.transition_x_leaveTo {
	opacity: 0;
	transform: translateY(-50%);
}

.transition_x_leaveActive {
	position: absolute;
}

.reverse {
	display: flex;
	flex-direction: column-reverse;
}

.root {
	container-type: inline-size;

	&.noGap {
		background: var(--MI_THEME-panel);

		.note {
			border-bottom: solid 0.5px var(--MI_THEME-divider);
		}

		.ad {
			padding: 8px;
			background-size: auto auto;
			background-image: repeating-linear-gradient(45deg, transparent, transparent 8px, var(--MI_THEME-bg) 8px, var(--MI_THEME-bg) 14px);
			border-bottom: solid 0.5px var(--MI_THEME-divider);
		}
	}

	&:not(.noGap) {
		background: var(--MI_THEME-bg);

		.note {
			background: var(--MI_THEME-panel);
			border-radius: var(--MI-radius);
		}
	}

	.gapMarker {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--MI_THEME-textSoft);
		padding: 8px 0;
		font-size: 1.2em;
		user-select: none;
	}
}

.ad:empty {
	display: none;
}
</style>
