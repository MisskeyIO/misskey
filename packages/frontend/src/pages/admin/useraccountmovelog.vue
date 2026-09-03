<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div style="display: flex; flex-direction: column; gap: var(--MI-margin); flex-wrap: wrap;">
			<div :class="$style.inputs">
					<MkSelect
						v-model="from"
						:items="serverLocationItems"
					:class="$style.input"
				>
					<template #label>{{ i18n.ts._accountMigration.movedFromServer }}</template>
				</MkSelect>
					<MkSelect
						v-model="to"
						:items="serverLocationItems"
					:class="$style.input"
				>
					<template #label>{{ i18n.ts._accountMigration.movedToServer }}</template>
				</MkSelect>
			</div>
			<div :class="$style.inputs">
				<MkInput v-model="movedFromId" :class="$style.input">
					<template #label> {{ i18n.ts.moveFromId }}</template>
				</MkInput>
				<MkInput v-model="movedToId" :class="$style.input">
					<template #label> {{ i18n.ts.movedToId }}</template>
				</MkInput>
			</div>
		</div>

			<MkPagination v-slot="{items}" :paginator="paginator" style="margin-top: var(--MI-margin);">
			<div class="_gaps_s">
				<MkFolder v-for="item in items" :key="item.id">
					<template #label>
						{{ i18n.tsx.userAccountMoveLogsTitle({
							from: '@' + item.movedFrom.username + (item.movedFrom.host ? `@${item.movedFrom.host}` : ''),
							to: '@' + item.movedTo.username + (item.movedTo.host ? `@${item.movedTo.host}` : '')
						})
						}}
					</template>
					<div :class="$style.card">
						<MkA :to="userPage(item.movedFrom)" :class="$style.cardContent">
							<MkAvatar :user="item.movedFrom" :class="$style.avatar" link/>
							<MkAcct :user="item.movedFrom"/>
						</MkA>
						→
						<MkA :to="userPage(item.movedTo)" :class="$style.cardContent">
							<MkAvatar :user="item.movedTo" :class="$style.avatar"/>
							<MkAcct :user="item.movedTo"/>
						</MkA>
					</div>
				</MkFolder>
			</div>
		</MkPagination>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, ref, markRaw } from 'vue';
import MkInput from '@/components/MkInput.vue';
import MkPagination from '@/components/MkPagination.vue';
import { i18n } from '@/i18n.js';
import { userPage } from '@/filters/user.js';
import MkFolder from '@/components/MkFolder.vue';
import { definePage } from '@/page.js';
import MkSelect from '@/components/MkSelect.vue';
import type { MkSelectItem } from '@/components/MkSelect.vue';
import { Paginator } from '@/utility/paginator.js';

type ServerLocation = 'all' | 'remote' | 'local';

const serverLocationItems = [
	{ label: i18n.ts.all, value: 'all' },
	{ label: i18n.ts.remote, value: 'remote' },
	{ label: i18n.ts.local, value: 'local' },
] satisfies MkSelectItem<ServerLocation>[];

const movedToId = ref('');
const movedFromId = ref('');
const from = ref<ServerLocation>('all');
const to = ref<ServerLocation>('all');

const paginator = markRaw(new Paginator('admin/show-user-account-move-logs', {
	limit: 30,
	computedParams: computed(() => ({
		movedFromId: movedFromId.value === '' ? null : movedFromId.value,
		movedToId: movedToId.value === '' ? null : movedToId.value,
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

<style lang="scss" module>
.card {
	display: flex;
	gap: var(--MI-margin);
	border-radius: var(--MI-radius);
	padding: var(--MI-margin);
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
}
.avatar {
	width: 48px;
	height: 48px;
}

.cardContent{
	display: flex;
	gap: var(--MI-margin);
	align-items: center;
	flex-direction: column;
}

.inputs {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}

.input {
	margin: 0;
	flex: 1;
}
</style>
