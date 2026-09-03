<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<component :is="prefer.s.enablePullToRefresh ? MkPullToRefresh : 'div'" :refresher="() => reloadTimeline()">
	<MkLoading v-if="paginator.fetching.value"/>

	<MkError v-else-if="paginator.error.value" @retry="paginator.init()"/>

	<div v-else-if="paginator.items.value.length === 0" key="_empty_">
		<slot name="empty"><MkResult type="empty" :text="i18n.ts.noNotes"/></slot>
	</div>

	<div v-else ref="rootEl">
		<div v-if="paginator.queuedAheadItemsCount.value > 0" :class="$style.new">
			<div :class="$style.newBg1"></div>
			<div :class="$style.newBg2"></div>
			<button class="_button" :class="$style.newButton" @click="releaseQueue()"><i class="ti ti-circle-arrow-up"></i> {{ i18n.ts.newNote }}</button>
		</div>
		<component
			:is="prefer.s.animation ? TransitionGroup : 'div'"
			:class="$style.notes"
			:enterActiveClass="$style.transition_x_enterActive"
			:leaveActiveClass="$style.transition_x_leaveActive"
			:enterFromClass="$style.transition_x_enterFrom"
			:leaveToClass="$style.transition_x_leaveTo"
			:moveClass="$style.transition_x_move"
			tag="div"
		>
			<template v-for="(note, i) in paginator.items.value" :key="note.id">
				<div v-if="note._shouldInsertGapMarker_" :class="$style.gapMarker" :data-scroll-anchor="note.id">
					<span aria-hidden="true">⋮</span>
				</div>
				<div v-else-if="getTimelineSeparatorInfo(i)" :data-scroll-anchor="note.id">
					<div :class="$style.date">
						<span><i class="ti ti-chevron-up"></i> {{ getTimelineSeparatorInfo(i)?.prevText }}</span>
						<span style="height: 1em; width: 1px; background: var(--MI_THEME-divider);"></span>
						<span>{{ getTimelineSeparatorInfo(i)?.nextText }} <i class="ti ti-chevron-down"></i></span>
					</div>
					<MkNote :class="$style.note" :note="asNote(note)" :withHardMute="true"/>
				</div>
				<div v-else-if="note._shouldInsertAd_" :data-scroll-anchor="note.id">
					<MkNote :class="$style.note" :note="asNote(note)" :withHardMute="true"/>
					<div :class="$style.ad">
						<MkAd :preferForms="['horizontal', 'horizontal-big']"/>
					</div>
				</div>
				<MkNote v-else :class="$style.note" :note="asNote(note)" :withHardMute="true" :data-scroll-anchor="note.id"/>
			</template>
		</component>
		<button v-show="paginator.canFetchOlder.value" key="_more_" v-appear="prefer.s.enableInfiniteScroll ? paginator.fetchOlder : null" :disabled="paginator.fetchingOlder.value" class="_button" :class="$style.more" @click="paginator.fetchOlder">
			<div v-if="!paginator.fetchingOlder.value">{{ i18n.ts.loadMore }}</div>
			<MkLoading v-else :inline="true"/>
		</button>
	</div>
</component>
</template>

<script lang="ts" setup>
import { computed, watch, onUnmounted, provide, useTemplateRef, TransitionGroup, onMounted } from 'vue';
import * as Misskey from 'misskey-js';
import { useInterval } from '@@/js/use-interval.js';
import { getScrollContainer, scrollToTop } from '@@/js/scroll.js';
import type { BasicTimelineType } from '@/timelines.js';
import type { PagingCtx } from '@/composables/use-pagination.js';
import { usePagination } from '@/composables/use-pagination.js';
import MkPullToRefresh from '@/components/MkPullToRefresh.vue';
import { useStream } from '@/stream.js';
import * as sound from '@/utility/sound.js';
import { deepMerge } from '@/utility/merge.js';
import type { DeepPartial } from '@/utility/merge.js';
import { $i } from '@/i.js';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import MkNote from '@/components/MkNote.vue';
import { i18n } from '@/i18n.js';
import { useGlobalEvent } from '@/events.js';
import { isSeparatorNeeded, getSeparatorInfo } from '@/utility/timeline-date-separate.js';
import { retryWithFibonacciBackoff } from '@/utility/retry.js';

const props = withDefaults(defineProps<{
	src: BasicTimelineType | 'mentions' | 'directs' | 'list' | 'antenna' | 'channel' | 'role';
	list?: string;
	antenna?: string;
	channel?: string;
	role?: string;
	dimension?: number;
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
	note: [];
}>();

provide('inTimeline', true);
provide('tl_withSensitive', computed(() => props.withSensitive));
provide('tl_dimension', computed(() => props.dimension ?? prefer.r.dimension.value));
provide('inChannel', computed(() => props.src === 'channel'));

function isTop() {
	if (scrollContainer == null) return true;
	if (rootEl.value == null) return true;
	const scrollTop = scrollContainer.scrollTop;
	const tlTop = rootEl.value.offsetTop - scrollContainer.offsetTop;
	return scrollTop <= tlTop;
}

let scrollContainer: HTMLElement | null = null;

function onScrollContainerScroll() {
	if (isTop()) {
		paginator.releaseQueue();
	}
}

const rootEl = useTemplateRef('rootEl');
watch(rootEl, (el) => {
	if (el && scrollContainer == null) {
		scrollContainer = getScrollContainer(el);
		if (scrollContainer == null) return;
		scrollContainer.addEventListener('scroll', onScrollContainerScroll, { passive: true }); // ほんとはscrollendにしたいけどiosが非対応
	}
}, { immediate: true });

onUnmounted(() => {
	if (scrollContainer) {
		scrollContainer.removeEventListener('scroll', onScrollContainerScroll);
	}
});

type TimelineQueryType = {
	antennaId?: string,
	withRenotes?: boolean,
	withReplies?: boolean,
	withFiles?: boolean,
	visibility?: string,
	listId?: string,
	channelId?: string,
	roleId?: string,
	dimension?: number,
};

type TimelineItem = Misskey.entities.Note & {
	_shouldInsertAd_?: boolean;
	_shouldInsertGapMarker_?: boolean;
};
type StreamNote = Pick<Misskey.entities.Note, 'id'> & DeepPartial<Misskey.entities.Note>;

let adInsertionCounter = 0;
const notVisibleNoteData: StreamNote[] = [];
const pendingNoteFetches = new Map<string, Promise<void>>();

const MIN_POLLING_INTERVAL = 1000 * 10;
const POLLING_INTERVAL =
	prefer.s.pollingInterval === 1 ? MIN_POLLING_INTERVAL * 1.5 * 1.5 :
	prefer.s.pollingInterval === 2 ? MIN_POLLING_INTERVAL * 1.5 :
	prefer.s.pollingInterval === 3 ? MIN_POLLING_INTERVAL :
	MIN_POLLING_INTERVAL;

if (!store.s.realtimeMode) {
	// TODO: 先頭のノートの作成日時が1日以上前であれば流速が遅いTLと見做してインターバルを通常より延ばす
	useInterval(async () => {
		paginator.fetchNewer({
			toQueue: !isTop(),
		});
	}, POLLING_INTERVAL, {
		immediate: false,
		afterMounted: true,
	});

	useGlobalEvent('notePosted', (note) => {
		paginator.fetchNewer({
			toQueue: !isTop(),
		});
	});
}

useGlobalEvent('noteDeleted', (noteId) => {
	paginator.removeItem(noteId);
});

function releaseQueue() {
	paginator.releaseQueue();
	if (rootEl.value) scrollToTop(rootEl.value);
}

function getTimelineSeparatorInfo(index: number) {
	const previous = paginator.items.value[index - 1];
	const current = paginator.items.value[index];
	if (!previous || !current || previous._shouldInsertGapMarker_) return null;
	if (!isSeparatorNeeded(previous.createdAt, current.createdAt)) return null;
	return getSeparatorInfo(previous.createdAt, current.createdAt);
}

function asNote(note: unknown): Misskey.entities.Note {
	return note as Misskey.entities.Note;
}

async function fetchNoteJson(id: string): Promise<Misskey.entities.Note> {
	const response = await window.fetch(`/notes/${id}.json`, {
		credentials: 'omit',
	});
	if (!response.ok) {
		throw new Error(`ノートJSONの取得に失敗しました: ${response.status}`);
	}
	return await response.json() as Misskey.entities.Note;
}

function insertResolvedNote(note: TimelineItem, toQueue = !isTop()) {
	adInsertionCounter++;

	if (instance.notesPerOneAd > 0 && adInsertionCounter % instance.notesPerOneAd === 0) {
		note._shouldInsertAd_ = true;
	}

	if (toQueue) {
		paginator.enqueue(note);
	} else {
		paginator.prepend(note);
	}
}

function scheduleMinimizedNoteRetry(data: StreamNote) {
	if (pendingNoteFetches.has(data.id)) return;

	const retry = retryWithFibonacciBackoff(() => fetchNoteJson(data.id), {
		maxAttempts: 3,
		initialDelayMs: 100,
	}).then((note) => {
		void prepend(deepMerge<Misskey.entities.Note>(data, note));
	}).catch((error) => {
		console.error('ノートJSONの再取得に失敗しました', data.id, error);
	}).finally(() => {
		pendingNoteFetches.delete(data.id);
	});

	pendingNoteFetches.set(data.id, retry);
}

async function fulfillNoteData(data: StreamNote): Promise<Misskey.entities.Note | null> {
	// 軽量通知にはvisibilityがない
	if (data.visibility == null) {
		if (pendingNoteFetches.has(data.id)) return null;

		try {
			const note = await fetchNoteJson(data.id);
			return deepMerge<Misskey.entities.Note>(data, note);
		} catch {
			scheduleMinimizedNoteRetry(data);
			return null;
		}
	}

	return data as Misskey.entities.Note;
}

async function prepend(data: StreamNote) {
	let note = data;

	if (window.document.hidden) {
		notVisibleNoteData.push(data);
		if (notVisibleNoteData.length > 10) notVisibleNoteData.shift();
	} else {
		const resolvedNote = await fulfillNoteData(data);
		if (resolvedNote == null) return;
		note = resolvedNote;
		insertResolvedNote(resolvedNote);
	}

	emit('note');

	if (props.sound) {
		sound.playMisskeySfx($i && (note.userId === $i.id) ? 'noteMy' : 'note');
	}
}

async function loadUnloadedNotes() {
	if (window.document.hidden || notVisibleNoteData.length === 0) return;

	const items = notVisibleNoteData.splice(0);
	const notes = await Promise.allSettled(items.map(fulfillNoteData));
	const fulfilledNotes = notes
		.filter((result): result is PromiseFulfilledResult<Misskey.entities.Note> => result.status === 'fulfilled' && result.value != null)
		.map(result => result.value);
	if (fulfilledNotes.length === 0) return;

	const toQueue = !isTop();
	if (items.length >= 10) {
		if (toQueue) {
			paginator.enqueue({
				id: `gap-marker-${Date.now()}`,
				_shouldInsertGapMarker_: true,
			} as TimelineItem);
		} else {
			for (const id of paginator.items.value.map(item => item.id)) {
				paginator.removeItem(id);
			}
		}
	}

	for (const note of fulfilledNotes) {
		insertResolvedNote(note, toQueue);
	}
}

let connection: Misskey.IChannelConnection<any> | null = null;
let connection2: Misskey.IChannelConnection<any> | null = null;
let paginationQuery!: PagingCtx;

const stream = store.s.realtimeMode ? useStream() : null;

function connectChannel() {
	if (stream == null) return;
	const dimension = props.dimension ?? prefer.r.dimension.value;

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
			dimension,
			minimize: true,
		});
		connection2 = stream.useChannel('main');
	} else if (props.src === 'local') {
		connection = stream.useChannel('localTimeline', {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: props.onlyFiles ? true : undefined,
			dimension,
			minimize: true,
		});
	} else if (props.src === 'media') {
		connection = stream.useChannel('hybridTimeline', {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: true,
			dimension,
			minimize: true,
		});
	} else if (props.src === 'social') {
		connection = stream.useChannel('hybridTimeline', {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: props.onlyFiles ? true : undefined,
			dimension,
			minimize: true,
		});
	} else if (props.src === 'global') {
		connection = stream.useChannel('globalTimeline', {
			withRenotes: props.withRenotes,
			withFiles: props.onlyFiles ? true : undefined,
			dimension,
			minimize: true,
		});
	} else if (props.src === 'mentions') {
		connection = stream.useChannel('main');
		connection?.on('mention', prepend);
	} else if (props.src === 'directs') {
		const onNote = note => {
			if (note.visibility === 'specified') {
				prepend(note);
			}
		};
		connection = stream.useChannel('main');
		connection?.on('mention', onNote);
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
			dimension,
			minimize: true,
		});
	} else if (props.src === 'role') {
		if (props.role == null) return;
		connection = stream.useChannel('roleTimeline', {
			roleId: props.role,
			dimension,
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
	const dimension = props.dimension ?? prefer.r.dimension.value;

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
			dimension,
		};
	} else if (props.src === 'local') {
		endpoint = 'notes/local-timeline';
		query = {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: props.onlyFiles ? true : undefined,
			dimension,
		};
	} else if (props.src === 'media') {
		endpoint = 'notes/hybrid-timeline';
		query = {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: true,
			dimension,
		};
	} else if (props.src === 'social') {
		endpoint = 'notes/hybrid-timeline';
		query = {
			withRenotes: props.withRenotes,
			withReplies: props.withReplies,
			withFiles: props.onlyFiles ? true : undefined,
			dimension,
		};
	} else if (props.src === 'global') {
		endpoint = 'notes/global-timeline';
		query = {
			withRenotes: props.withRenotes,
			withFiles: props.onlyFiles ? true : undefined,
			dimension,
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
			dimension,
		};
	} else if (props.src === 'role') {
		endpoint = 'roles/notes';
		query = {
			roleId: props.role,
			dimension,
		};
	} else {
		throw new Error('Unrecognized timeline type: ' + props.src);
	}

	paginationQuery = {
		endpoint: endpoint,
		limit: 10,
		params: query,
	};
}

function refreshEndpointAndChannel() {
	if (store.s.realtimeMode) {
		disconnectChannel();
		connectChannel();
	}

	updatePaginationQuery();
}

// デッキのリストカラムでwithRenotesを変更した場合に自動的に更新されるようにさせる
// IDが切り替わったら切り替え先のTLを表示させたい
watch(() => [props.list, props.antenna, props.channel, props.role, props.withRenotes, props.dimension], refreshEndpointAndChannel);

// withSensitiveはクライアントで完結する処理のため、単にリロードするだけでOK
watch(() => props.withSensitive, reloadTimeline);

// 初回表示用
refreshEndpointAndChannel();

onMounted(() => {
	window.document.addEventListener('visibilitychange', loadUnloadedNotes);
});

const paginator = usePagination<keyof Misskey.Endpoints, TimelineItem>({
	ctx: paginationQuery,
	useShallowRef: true,
});

onUnmounted(() => {
	disconnectChannel();
	window.document.removeEventListener('visibilitychange', loadUnloadedNotes);
});

function reloadTimeline() {
	return new Promise<void>((res) => {
		adInsertionCounter = 0;

		paginator.reload().then(() => {
			res();
		});
	});
}

defineExpose({
	reloadTimeline,
});
</script>

<style lang="scss" module>
.transition_x_move {
	transition: transform 0.7s cubic-bezier(0.23, 1, 0.32, 1);
}

.transition_x_enterActive {
	transition: transform 0.7s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.7s cubic-bezier(0.23, 1, 0.32, 1);

	&.note,
	.note {
		/* Skip Note Rendering有効時、TransitionGroupでnoteを追加するときに一瞬がくっとなる問題を抑制する */
		content-visibility: visible !important;
	}
}

.transition_x_leaveActive {
	transition: height 0.2s cubic-bezier(0,.5,.5,1), opacity 0.2s cubic-bezier(0,.5,.5,1);
}

.transition_x_enterFrom {
	opacity: 0;
	transform: translateY(max(-64px, -100%));
}

@supports (interpolate-size: allow-keywords) {
	.transition_x_leaveTo {
		interpolate-size: allow-keywords; // heightのtransitionを動作させるために必要
		height: 0;
	}
}

.transition_x_leaveTo {
	opacity: 0;
}

.notes {
	container-type: inline-size;
	background: var(--MI_THEME-panel);
}

.note {
	border-bottom: solid 0.5px var(--MI_THEME-divider);
}

.gapMarker {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 8px 0;
	border-bottom: solid 0.5px var(--MI_THEME-divider);
	color: var(--MI_THEME-textSoft);
	font-size: 1.2em;
	user-select: none;
}

.new {
	--gapFill: 0.5px; // 上位ヘッダーの高さにフォントの関係などで少数が含まれると、レンダリングエンジンによっては隙間が表示されてしまうため、隙間を隠すために少しずらす

	position: sticky;
	top: calc(var(--MI-stickyTop, 0px) - var(--gapFill));
	z-index: 1000;
	width: 100%;
	box-sizing: border-box;
	padding: calc(10px + var(--gapFill)) 0 10px 0;
}

/* 疑似progressive blur */
.newBg1, .newBg2 {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
}

.newBg1 {
	height: 100%;
	-webkit-backdrop-filter: var(--MI-blur, blur(2px));
	backdrop-filter: var(--MI-blur, blur(2px));
	mask-image: linear-gradient( /* 疑似Easing Linear Gradients */
		to top,
		rgb(0 0 0 / 0%) 0%,
		rgb(0 0 0 / 4.9%) 7.75%,
		rgb(0 0 0 / 10.4%) 11.25%,
		rgb(0 0 0 / 45%) 23.55%,
		rgb(0 0 0 / 55%) 26.45%,
		rgb(0 0 0 / 89.6%) 38.75%,
		rgb(0 0 0 / 95.1%) 42.25%,
		rgb(0 0 0 / 100%) 50%
	);
}

.newBg2 {
	height: 75%;
	-webkit-backdrop-filter: var(--MI-blur, blur(4px));
	backdrop-filter: var(--MI-blur, blur(4px));
	mask-image: linear-gradient( /* 疑似Easing Linear Gradients */
		to top,
		rgb(0 0 0 / 0%) 0%,
		rgb(0 0 0 / 4.9%) 15.5%,
		rgb(0 0 0 / 10.4%) 22.5%,
		rgb(0 0 0 / 45%) 47.1%,
		rgb(0 0 0 / 55%) 52.9%,
		rgb(0 0 0 / 89.6%) 77.5%,
		rgb(0 0 0 / 95.1%) 91.9%,
		rgb(0 0 0 / 100%) 100%
	);
}

.newButton {
	position: relative;
	display: block;
	padding: 6px 12px;
	border-radius: 999px;
	width: max-content;
	margin: auto;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
	font-size: 90%;

	&:hover {
		background: hsl(from var(--MI_THEME-accent) h s calc(l + 5));
	}

	&:active {
		background: hsl(from var(--MI_THEME-accent) h s calc(l - 5));
	}
}

.date {
	display: flex;
	font-size: 85%;
	align-items: center;
	justify-content: center;
	gap: 1em;
	opacity: 0.75;
	padding: 8px 8px;
	margin: 0 auto;
	border-bottom: solid 0.5px var(--MI_THEME-divider);
}

.ad {
	padding: 8px;
	background-size: auto auto;
	background-image: repeating-linear-gradient(45deg, transparent, transparent 8px, var(--MI_THEME-bg) 8px, var(--MI_THEME-bg) 14px);
	border-bottom: solid 0.5px var(--MI_THEME-divider);

	&:empty {
		display: none;
	}
}

.more {
	display: block;
	width: 100%;
	box-sizing: border-box;
	padding: 16px;
	background: var(--MI_THEME-panel);
}
</style>
