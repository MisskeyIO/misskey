<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div v-if="tab === 'list'" :class="$style.root" class="_gaps">
			<div :class="$style.subMenus" class="_gaps">
				<MkButton type="routerLink" to="/admin/abuse-report-notification-recipient" primary>{{ i18n.ts.notificationSetting }}</MkButton>
			</div>

			<MkTip k="abuses">
				{{ i18n.ts._abuseUserReport.resolveTutorial }}
			</MkTip>

			<div :class="$style.inputs" class="_gaps">
				<MkSelect v-model="state" :items="stateDef" style="margin: 0; flex: 1;">
					<template #label>{{ i18n.ts.state }}</template>
				</MkSelect>
				<MkSelect v-model="targetUserOrigin" :items="targetUserOriginDef" style="margin: 0; flex: 1;">
					<template #label>{{ i18n.ts.reporteeOrigin }}</template>
				</MkSelect>
				<MkSelect v-model="reporterOrigin" :items="reporterOriginDef" style="margin: 0; flex: 1;">
					<template #label>{{ i18n.ts.reporterOrigin }}</template>
				</MkSelect>
			</div>

			<!-- TODO
			<div class="inputs" style="display: flex; padding-top: 1.2em;">
				<MkInput v-model="searchUsername" style="margin: 0; flex: 1;" type="text" :spellcheck="false">
					<span>{{ i18n.ts.username }}</span>
				</MkInput>
				<MkInput v-model="searchHost" style="margin: 0; flex: 1;" type="text" :spellcheck="false" :disabled="paginator.computedParams.value.origin === 'local'">
					<span>{{ i18n.ts.host }}</span>
				</MkInput>
			</div>
			-->

			<MkPagination v-slot="{items}" :paginator="paginator">
				<div class="_gaps">
					<XAbuseReport v-for="report in items" :key="report.id" :report="report" @resolved="resolved"/>
				</div>
			</MkPagination>
		</div>

		<div v-else-if="tab === 'resolver'" class="_gaps">
			<MkFolder>
				<template #icon><i class="ti ti-plus"></i></template>
				<template #label>{{ i18n.ts.createNew }}</template>

				<MkAbuseReportResolver v-model="newResolver" :editable="true">
					<template #footer>
						<MkButton primary :disabled="newResolver.name.trim() === ''" @click="createResolver">{{ i18n.ts.create }}</MkButton>
					</template>
				</MkAbuseReportResolver>
			</MkFolder>

			<MkPagination v-slot="{items}" :paginator="resolverPaginator">
				<div class="_gaps_s">
					<MkFolder v-for="resolver in items" :key="resolver.id" :defaultOpen="editableResolverId === resolver.id">
						<template #icon><i class="ti ti-shield-check"></i></template>
						<template #label>{{ resolver.name }}</template>
						<template #suffix><MkTime :time="resolver.updatedAt"/></template>

						<MkAbuseReportResolver
							v-if="editableResolverId === resolver.id"
							v-model="editingResolver"
							:editable="true"
						>
							<template #footer>
								<div class="_buttons">
									<MkButton primary :disabled="editingResolver.name.trim() === ''" @click="saveResolver"><i class="ti ti-device-floppy"></i> {{ i18n.ts.save }}</MkButton>
									<MkButton @click="cancelEditResolver"><i class="ti ti-x"></i> {{ i18n.ts.cancel }}</MkButton>
								</div>
							</template>
						</MkAbuseReportResolver>
						<MkAbuseReportResolver v-else :modelValue="toEditorModel(resolver)" :editable="false">
							<template #footer>
								<div class="_buttons">
									<MkButton inline @click="editResolver(resolver)"><i class="ti ti-pencil"></i> {{ i18n.ts.edit }}</MkButton>
									<MkButton inline danger @click="deleteResolver(resolver)"><i class="ti ti-trash"></i> {{ i18n.ts.remove }}</MkButton>
								</div>
							</template>
						</MkAbuseReportResolver>
					</MkFolder>
				</div>
			</MkPagination>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, ref, markRaw } from 'vue';
import * as Misskey from 'misskey-js';
import MkSelect from '@/components/MkSelect.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkAbuseReportResolver from '@/components/MkAbuseReportResolver.vue';
import XAbuseReport from '@/components/MkAbuseReport.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import MkButton from '@/components/MkButton.vue';
import { Paginator } from '@/utility/paginator.js';
import * as os from '@/os.js';

type AbuseReportResolver = Misskey.entities.AdminAbuseReportResolverListResponse[number];
type ExpiresAt = Misskey.entities.AdminAbuseReportResolverCreateRequest['expiresAt'];
type AbuseReportResolverEditorModel = {
	name: string;
	targetUserPattern: string;
	reporterPattern: string;
	reportContentPattern: string;
	expiresAt: ExpiresAt;
	forward: boolean;
	expirationDate: string | null;
};

const {
	model: state,
	def: stateDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'all' },
		{ label: i18n.ts.unresolved, value: 'unresolved' },
		{ label: i18n.ts.resolved, value: 'resolved' },
	],
	initialValue: 'unresolved',
});
const {
	model: reporterOrigin,
	def: reporterOriginDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'combined' },
		{ label: i18n.ts.local, value: 'local' },
		{ label: i18n.ts.remote, value: 'remote' },
	],
	initialValue: 'combined',
});
const {
	model: targetUserOrigin,
	def: targetUserOriginDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'combined' },
		{ label: i18n.ts.local, value: 'local' },
		{ label: i18n.ts.remote, value: 'remote' },
	],
	initialValue: 'combined',
});
const tab = ref('list');
const editableResolverId = ref<string | null>(null);
const editingResolver = ref<AbuseReportResolverEditorModel>(createDefaultResolver());

function createDefaultResolver(): AbuseReportResolverEditorModel {
	return {
		name: '',
		targetUserPattern: '',
		reporterPattern: '',
		reportContentPattern: '',
		expiresAt: 'indefinitely',
		forward: false,
		expirationDate: null,
	};
}

const newResolver = ref<AbuseReportResolverEditorModel>(createDefaultResolver());

const paginator = markRaw(new Paginator('admin/abuse-user-reports', {
	limit: 10,
	computedParams: computed(() => ({
		state: state.value,
		reporterOrigin: reporterOrigin.value,
		targetUserOrigin: targetUserOrigin.value,
	})),
}));

const resolverPaginator = markRaw(new Paginator('admin/abuse-report-resolver/list', {
	limit: 10,
}));

function resolved(reportId: string) {
	paginator.removeItem(reportId);
}

function toEditorModel(resolver: AbuseReportResolver): AbuseReportResolverEditorModel {
	return {
		name: resolver.name,
		targetUserPattern: resolver.targetUserPattern ?? '',
		reporterPattern: resolver.reporterPattern ?? '',
		reportContentPattern: resolver.reportContentPattern ?? '',
		expiresAt: resolver.expiresAt,
		forward: resolver.forward,
		expirationDate: resolver.expirationDate,
	};
}

function toNullablePattern(pattern: string): string | null {
	const normalized = pattern.trim();
	return normalized === '' ? null : normalized;
}

async function createResolver() {
	await os.apiWithDialog('admin/abuse-report-resolver/create', {
		name: newResolver.value.name,
		targetUserPattern: toNullablePattern(newResolver.value.targetUserPattern),
		reporterPattern: toNullablePattern(newResolver.value.reporterPattern),
		reportContentPattern: toNullablePattern(newResolver.value.reportContentPattern),
		expiresAt: newResolver.value.expiresAt,
		forward: newResolver.value.forward,
	});
	newResolver.value = createDefaultResolver();
	await resolverPaginator.reload();
}

function editResolver(resolver: AbuseReportResolver) {
	editableResolverId.value = resolver.id;
	editingResolver.value = toEditorModel(resolver);
}

function cancelEditResolver() {
	editableResolverId.value = null;
	editingResolver.value = createDefaultResolver();
}

async function saveResolver() {
	if (editableResolverId.value == null) return;

	await os.apiWithDialog('admin/abuse-report-resolver/update', {
		resolverId: editableResolverId.value,
		name: editingResolver.value.name,
		targetUserPattern: toNullablePattern(editingResolver.value.targetUserPattern),
		reporterPattern: toNullablePattern(editingResolver.value.reporterPattern),
		reportContentPattern: toNullablePattern(editingResolver.value.reportContentPattern),
		expiresAt: editingResolver.value.expiresAt,
		forward: editingResolver.value.forward,
	});
	cancelEditResolver();
	await resolverPaginator.reload();
}

async function deleteResolver(resolver: AbuseReportResolver) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx.deleteAreYouSure({ x: resolver.name }),
	});
	if (canceled) return;

	await os.apiWithDialog('admin/abuse-report-resolver/delete', {
		resolverId: resolver.id,
	});
	await resolverPaginator.reload();
}

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'list',
	title: i18n.ts._abuse.list,
	icon: 'ti ti-list',
}, {
	key: 'resolver',
	title: i18n.ts._abuse.resolver,
	icon: 'ti ti-shield-check',
}]);

definePage(() => ({
	title: i18n.ts.abuseReports,
	icon: 'ti ti-exclamation-circle',
}));
</script>

<style module lang="scss">
.root {
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: stretch;
}

.subMenus {
	display: flex;
	flex-direction: row;
	justify-content: flex-end;
	align-items: center;
}

.inputs {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
}
</style>
