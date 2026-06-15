<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/account-stats" :label="i18n.ts.accountStats" :keywords="['account', 'stats', 'statistics', 'security']" icon="ti ti-chart-bar">
	<div class="_gaps_m">
		<MkFeatureBanner icon="/client-assets/chart_3d.png" color="#66a6ff">
			<SearchText>{{ settingsI18n.accountStatsBanner }}</SearchText>
		</MkFeatureBanner>

		<MkLoading v-if="fetching"/>
		<MkInfo v-else-if="errorMessage" warn>{{ errorMessage }}</MkInfo>
		<template v-else>
			<FormSection v-if="stats != null" first>
				<template #label><SearchLabel>{{ i18n.ts.statistics }}</SearchLabel></template>
				<div class="_gaps_s">
					<MkKeyValue v-for="item in statsItems" :key="item.key" oneline>
						<template #key>{{ item.label }}</template>
						<template #value>{{ item.value }}</template>
					</MkKeyValue>
				</div>
			</FormSection>

			<FormSection v-if="securityInfo != null">
				<template #label><SearchLabel>{{ i18n.ts.securityInfo }}</SearchLabel></template>
				<div class="_gaps_s">
					<MkKeyValue v-for="item in securityItems" :key="item.key" oneline>
						<template #key>{{ item.label }}</template>
						<template #value>{{ item.value }}</template>
					</MkKeyValue>
				</div>
			</FormSection>
		</template>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { apiUrl } from '@@/js/config.js';
import FormSection from '@/components/form/section.vue';
import MkFeatureBanner from '@/components/MkFeatureBanner.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import bytes from '@/filters/bytes.js';
import number from '@/filters/number.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

type AccountStats = {
	notesCount: number;
	repliesCount: number;
	renotesCount: number;
	repliedCount: number;
	renotedCount: number;
	pollVotesCount: number;
	pollVotedCount: number;
	localFollowingCount: number;
	remoteFollowingCount: number;
	localFollowersCount: number;
	remoteFollowersCount: number;
	followingCount: number;
	followersCount: number;
	sentReactionsCount: number;
	receivedReactionsCount: number;
	noteFavoritesCount: number;
	pageLikesCount: number;
	pageLikedCount: number;
	driveFilesCount: number;
	driveUsage: number;
};

type SecurityInfo = {
	twoFactorEnabled?: boolean;
	securityKeys?: boolean;
	usePasswordLessLogin?: boolean;
};

type FeatureEndpointRequest = Record<string, unknown>;
type SettingsLocale = typeof i18n.ts._settings & {
	accountStatsBanner: string;
};

const settingsI18n = i18n.ts._settings as SettingsLocale;

const fetching = ref(true);
const errorMessage = ref<string | null>(null);
const stats = ref<AccountStats | null>(null);
const securityInfo = ref<SecurityInfo | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

async function featureApi<Res>(endpoint: string, data: FeatureEndpointRequest): Promise<Res> {
	const body: FeatureEndpointRequest = { ...data };
	if ($i != null) body.i = $i.token;
	const res = await window.fetch(`${apiUrl}/${endpoint}`, {
		method: 'POST',
		body: JSON.stringify(body),
		credentials: 'omit',
		cache: 'no-cache',
		headers: {
			'Content-Type': 'application/json',
		},
	});
	const responseBody: unknown = res.status === 204 ? undefined : await res.json();
	if (res.ok) return responseBody as Res;

	if (isRecord(responseBody) && isRecord(responseBody.error) && typeof responseBody.error.message === 'string') {
		throw new Error(responseBody.error.message);
	}

	throw new Error(`API request failed: ${endpoint}`);
}

const booleanText = (value: boolean | undefined): string => value ? i18n.ts.yes : i18n.ts.no;

const statsItems = computed(() => {
	if (stats.value == null) return [];
	return [
		{ key: 'notesCount', label: i18n.ts.notesCount, value: number(stats.value.notesCount) },
		{ key: 'repliesCount', label: i18n.ts.repliesCount, value: number(stats.value.repliesCount) },
		{ key: 'renotesCount', label: i18n.ts.renotesCount, value: number(stats.value.renotesCount) },
		{ key: 'repliedCount', label: i18n.ts.repliedCount, value: number(stats.value.repliedCount) },
		{ key: 'renotedCount', label: i18n.ts.renotedCount, value: number(stats.value.renotedCount) },
		{ key: 'pollVotesCount', label: i18n.ts.pollVotesCount, value: number(stats.value.pollVotesCount) },
		{ key: 'pollVotedCount', label: i18n.ts.pollVotedCount, value: number(stats.value.pollVotedCount) },
		{ key: 'sentReactionsCount', label: i18n.ts.sentReactionsCount, value: number(stats.value.sentReactionsCount) },
		{ key: 'receivedReactionsCount', label: i18n.ts.receivedReactionsCount, value: number(stats.value.receivedReactionsCount) },
		{ key: 'noteFavoritesCount', label: i18n.ts.noteFavoritesCount, value: number(stats.value.noteFavoritesCount) },
		{ key: 'followingCount', label: i18n.ts.followingCount, value: number(stats.value.followingCount) },
		{ key: 'localFollowingCount', label: `${i18n.ts.followingCount} (${i18n.ts.local})`, value: number(stats.value.localFollowingCount) },
		{ key: 'remoteFollowingCount', label: `${i18n.ts.followingCount} (${i18n.ts.remote})`, value: number(stats.value.remoteFollowingCount) },
		{ key: 'followersCount', label: i18n.ts.followersCount, value: number(stats.value.followersCount) },
		{ key: 'localFollowersCount', label: `${i18n.ts.followersCount} (${i18n.ts.local})`, value: number(stats.value.localFollowersCount) },
		{ key: 'remoteFollowersCount', label: `${i18n.ts.followersCount} (${i18n.ts.remote})`, value: number(stats.value.remoteFollowersCount) },
		{ key: 'pageLikesCount', label: i18n.ts.pageLikesCount, value: number(stats.value.pageLikesCount) },
		{ key: 'pageLikedCount', label: i18n.ts.pageLikedCount, value: number(stats.value.pageLikedCount) },
		{ key: 'driveFilesCount', label: i18n.ts.driveFilesCount, value: number(stats.value.driveFilesCount) },
		{ key: 'driveUsage', label: i18n.ts.driveUsage, value: bytes(stats.value.driveUsage) },
	];
});

const securityItems = computed(() => {
	if (securityInfo.value == null) return [];
	return [
		{ key: 'twoFactorEnabled', label: i18n.ts.twoFactorEnabled, value: booleanText(securityInfo.value.twoFactorEnabled) },
		{ key: 'securityKeys', label: i18n.ts.securityKeys, value: booleanText(securityInfo.value.securityKeys) },
		{ key: 'usePasswordLessLogin', label: i18n.ts.passwordLessLogin, value: booleanText(securityInfo.value.usePasswordLessLogin) },
	];
});

onMounted(async () => {
	if ($i == null) return;
	try {
		const [accountStats, accountSecurityInfo] = await Promise.all([
			featureApi<AccountStats>('users/stats', { userId: $i.id }),
			featureApi<SecurityInfo>('users/get-security-info', { userId: $i.id }),
		]);
		stats.value = accountStats;
		securityInfo.value = accountSecurityInfo;
	} catch (err) {
		errorMessage.value = err instanceof Error ? err.message : i18n.ts.somethingHappened;
	} finally {
		fetching.value = false;
	}
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.accountStats,
	icon: 'ti ti-chart-bar',
}));
</script>
