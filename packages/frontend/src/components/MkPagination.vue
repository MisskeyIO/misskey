<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<component :is="prefer.s.enablePullToRefresh && pullToRefresh ? MkPullToRefresh : 'div'" :refresher="() => paginator.reload()" @contextmenu.prevent.stop="onContextmenu">
	<div>
		<MkPaginationControl v-if="withControl" :paginator="paginator" style="margin-bottom: 10px"/>

		<!-- :css="prefer.s.animation" にしたいけどバグる(おそらくvueのバグ) https://github.com/misskey-dev/misskey/issues/16078 -->
		<Transition
			:enterActiveClass="prefer.s.animation ? $style.transition_fade_enterActive : ''"
			:leaveActiveClass="prefer.s.animation ? $style.transition_fade_leaveActive : ''"
			:enterFromClass="prefer.s.animation ? $style.transition_fade_enterFrom : ''"
			:leaveToClass="prefer.s.animation ? $style.transition_fade_leaveTo : ''"
			:mode="prefer.s.animation ? 'out-in' : undefined"
		>
			<MkLoading v-if="paginator.fetching.value"/>

			<MkError v-else-if="paginator.error.value" @retry="paginator.init()"/>

			<div v-else-if="paginator.items.value.length === 0" key="_empty_">
				<slot name="empty"><MkResult type="empty"/></slot>
			</div>

			<div v-else key="_root_" class="_gaps">
				<div v-if="effectiveDirection === 'up' || effectiveDirection === 'both'" v-show="upButtonVisible">
					<MkButton v-if="!upButtonLoading" v-appear="shouldEnableInfiniteScroll ? upButtonClick : null" :class="$style.more" primary rounded @click="upButtonClick">
						{{ i18n.ts.loadMore }}
					</MkButton>
					<MkLoading v-else/>
				</div>
				<slot :items="getValue(paginator.items)" :fetching="paginator.fetching.value || paginator.fetchingOlder.value || paginator.fetchingNewer.value"></slot>
				<div v-if="effectiveDirection === 'down' || effectiveDirection === 'both'" v-show="downButtonVisible">
					<MkButton v-if="!downButtonLoading" v-appear="shouldEnableInfiniteScroll ? downButtonClick : null" :class="$style.more" primary rounded @click="downButtonClick">
						{{ i18n.ts.loadMore }}
					</MkButton>
					<MkLoading v-else/>
				</div>
			</div>
		</Transition>
	</div>
</component>
</template>

<script lang="ts">
export type MkPaginationOptions = {
	autoLoad?: boolean;
	/**
	 * ページネーションを進める方向
	 * - up: 上方向
	 * - down: 下方向 (default)
	 * - both: 双方向
	 *
	 * NOTE: この方向はページネーションの方向であって、アイテムの並び順ではない
	 */
	direction?: 'up' | 'down' | 'both';
	pullToRefresh?: boolean;
	withControl?: boolean;
	forceDisableInfiniteScroll?: boolean;
};
</script>

<script lang="ts" setup generic="T extends IPaginator">
import { isLink } from '@@/js/is-link.js';
import { onMounted, computed, watch, unref, isRef } from 'vue';
import type { UnwrapRef, ComputedRef } from 'vue';
import { Paginator, type IPaginator, type MisskeyEntity } from '@/utility/paginator.js';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import MkPullToRefresh from '@/components/MkPullToRefresh.vue';
import MkPaginationControl from '@/components/MkPaginationControl.vue';
import * as os from '@/os.js';

export type Paging<E extends keyof Misskey.Endpoints = keyof Misskey.Endpoints> = {
	endpoint: E;
	limit: number;
	params?: Misskey.Endpoints[E]['req'] | ComputedRef<Misskey.Endpoints[E]['req']>;
	noPaging?: boolean;
	prepend?: boolean;
	offsetMode?: boolean;
};

const props = withDefaults(defineProps<MkPaginationOptions & {
	paginator?: T;
	pagination?: Paging;
	disableAutoLoad?: boolean;
}>(), {
	autoLoad: true,
	direction: undefined,
	pullToRefresh: true,
	withControl: false,
	forceDisableInfiniteScroll: false,
	disableAutoLoad: false,
});

const legacyPaginator = props.paginator ? null : createLegacyPaginator();
const paginator = props.paginator ?? legacyPaginator;

if (!paginator) {
	throw new Error('MkPagination requires either paginator or pagination prop.');
}

const effectiveDirection = computed(() => props.direction ?? (props.pagination?.prepend ? 'up' : 'down'));

const shouldEnableInfiniteScroll = computed(() => {
	return prefer.r.enableInfiniteScroll.value && !props.forceDisableInfiniteScroll;
});

function onContextmenu(ev: MouseEvent) {
	if (ev.target && isLink(ev.target as HTMLElement)) return;
	if (window.getSelection()?.toString() !== '') return;

	os.contextMenu([{
		icon: 'ti ti-refresh',
		text: i18n.ts.reload,
		action: () => {
			paginator.reload();
		},
	}], ev);
}

function getValue(v: IPaginator['items']) {
	return unref(v) as UnwrapRef<T['items']>;
}

const effectiveAutoLoad = computed(() => props.autoLoad && !props.disableAutoLoad);

if (effectiveAutoLoad.value) {
	onMounted(() => {
		paginator.init();
	});
}

if (paginator.computedParams) {
	watch(paginator.computedParams, () => {
		paginator.reload();
	}, { immediate: false, deep: true });
}

const upButtonVisible = computed(() => {
	return paginator.order.value === 'oldest' ? paginator.canFetchOlder.value : paginator.canFetchNewer.value;
});
const upButtonLoading = computed(() => {
	return paginator.order.value === 'oldest' ? paginator.fetchingOlder.value : paginator.fetchingNewer.value;
});

function upButtonClick() {
	if (paginator.order.value === 'oldest') {
		paginator.fetchOlder();
	} else {
		paginator.fetchNewer();
	}
}

const downButtonVisible = computed(() => {
	return paginator.order.value === 'oldest' ? paginator.canFetchNewer.value : paginator.canFetchOlder.value;
});
const downButtonLoading = computed(() => {
	return paginator.order.value === 'oldest' ? paginator.fetchingNewer.value : paginator.fetchingOlder.value;
});

function downButtonClick() {
	if (paginator.order.value === 'oldest') {
		paginator.fetchNewer();
	} else {
		paginator.fetchOlder();
	}
}

// Lightweight ad marker compatibility for legacy usage
watch(() => paginator.items.value, (items) => {
	if (!Array.isArray(items)) return;
	if (items[3] && !items[3]._shouldInsertAd_) items[3]._shouldInsertAd_ = true;
	if (items[10] && !items[10]._shouldInsertAd_) items[10]._shouldInsertAd_ = true;
}, { deep: false });

function createLegacyPaginator(): IPaginator | null {
	if (!props.pagination) return null;
	const params = props.pagination.params;
	const computedParams = isRef(params) ? params as ComputedRef<Misskey.Endpoints[typeof props.pagination.endpoint]['req']> : null;
	const staticParams = !isRef(params) ? (params ?? {}) : undefined;
	return new Paginator(props.pagination.endpoint as any, {
		limit: props.pagination.limit,
		params: staticParams,
		computedParams,
		noPaging: props.pagination.noPaging,
		offsetMode: props.pagination.offsetMode,
		order: props.pagination.prepend ? 'oldest' : 'newest',
	});
}

defineSlots<{
	empty: () => void;
	default: (props: { items: UnwrapRef<T['items']>, fetching: boolean }) => void;
}>();
</script>

<style lang="scss" module>
.transition_fade_enterActive,
.transition_fade_leaveActive {
	transition: opacity 0.125s ease;
}
.transition_fade_enterFrom,
.transition_fade_leaveTo {
	opacity: 0;
}

.more {
	margin-left: auto;
	margin-right: auto;
}
</style>
