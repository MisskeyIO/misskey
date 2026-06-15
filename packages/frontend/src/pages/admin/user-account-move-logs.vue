<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div class="_gaps">
			<div :class="$style.inputs">
				<MkSelect v-model="from" :items="originDef" style="flex: 1;">
					<template #label>{{ i18n.ts._accountMigration.movedFromServer }}</template>
				</MkSelect>
				<MkSelect v-model="to" :items="originDef" style="flex: 1;">
					<template #label>{{ i18n.ts._accountMigration.movedToServer }}</template>
				</MkSelect>
			</div>

			<div :class="$style.inputs">
				<MkInput v-model="movedFromId" style="flex: 1;">
					<template #label>{{ i18n.ts.moveFromId }}</template>
				</MkInput>
				<MkInput v-model="movedToId" style="flex: 1;">
					<template #label>{{ i18n.ts.movedToId }}</template>
				</MkInput>
			</div>

			<MkPagination v-slot="{items}" :paginator="paginator">
				<div class="_gaps_s">
					<MkFolder v-for="log in items" :key="log.id">
						<template #icon><i class="ti ti-plane-departure"></i></template>
						<template #label>{{ i18n.tsx.userAccountMoveLogsTitle({ from: `@${acct(log.movedFrom)}`, to: `@${acct(log.movedTo)}` }) }}</template>
						<template #suffix><MkTime :time="log.createdAt"/></template>

						<div :class="$style.moveLog">
							<MkA :to="`/admin/user/${log.movedFromId}`" :class="$style.user">
								<MkAvatar :user="log.movedFrom" :class="$style.avatar"/>
								<div>
									<div><MkAcct :user="log.movedFrom"/></div>
									<div class="_monospace" :class="$style.userId">{{ log.movedFromId }}</div>
								</div>
							</MkA>

							<i class="ti ti-arrow-right" :class="$style.arrow"></i>

							<MkA :to="`/admin/user/${log.movedToId}`" :class="$style.user">
								<MkAvatar :user="log.movedTo" :class="$style.avatar"/>
								<div>
									<div><MkAcct :user="log.movedTo"/></div>
									<div class="_monospace" :class="$style.userId">{{ log.movedToId }}</div>
								</div>
							</MkA>
						</div>
					</MkFolder>
				</div>
			</MkPagination>
		</div>
	</div>
</PageWithHeader>
</template>

<script setup lang="ts">
import { computed, markRaw, ref } from 'vue';
import MkFolder from '@/components/MkFolder.vue';
import MkInput from '@/components/MkInput.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkSelect from '@/components/MkSelect.vue';
import { useMkSelect } from '@/composables/use-mkselect.js';
import { acct } from '@/filters/user.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { Paginator } from '@/utility/paginator.js';

const {
	model: from,
	def: originDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'all' },
		{ label: i18n.ts.local, value: 'local' },
		{ label: i18n.ts.remote, value: 'remote' },
	],
	initialValue: 'all',
});
const { model: to } = useMkSelect({
	items: originDef,
	initialValue: 'all',
});
const movedFromId = ref('');
const movedToId = ref('');

const paginator = markRaw(new Paginator('admin/show-user-account-move-logs', {
	limit: 30,
	computedParams: computed(() => ({
		movedFromId: movedFromId.value.trim() === '' ? null : movedFromId.value.trim(),
		movedToId: movedToId.value.trim() === '' ? null : movedToId.value.trim(),
		from: from.value,
		to: to.value,
	})),
}));

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.userAccountMoveLogs,
	icon: 'ti ti-list-search',
}));
</script>

<style module lang="scss">
.inputs {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}

.moveLog {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
	gap: var(--MI-margin);
	align-items: center;
}

.user {
	display: flex;
	gap: 12px;
	align-items: center;
	min-width: 0;
	padding: 12px;
	border-radius: var(--MI-radius);
	background: var(--MI_THEME-bg);

	&:hover {
		text-decoration: none;
	}
}

.avatar {
	width: 42px;
	height: 42px;
	flex-shrink: 0;
}

.userId {
	margin-top: 2px;
	font-size: 0.85em;
	opacity: 0.7;
	word-break: break-all;
}

.arrow {
	opacity: 0.65;
}

@media (max-width: 600px) {
	.moveLog {
		grid-template-columns: 1fr;
	}

	.arrow {
		justify-self: center;
		transform: rotate(90deg);
	}
}
</style>
