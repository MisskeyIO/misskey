<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkSpacer :contentMax="narrow ? 800 : 1100">
	<div ref="rootEl" class="ftskorzw" :class="{ wide: !narrow }" style="container-type: inline-size;">
		<div class="main _gaps">
			<div v-if="user.isSuspended" class="punished"><i class="ti ti-alert-triangle" style="margin-right: 8px;"></i> {{ i18n.ts.userSuspended }}</div>
			<div v-if="user.isLimited" class="punished"><i class="ti ti-alert-triangle" style="margin-right: 8px;"></i> {{ i18n.ts.userLimited }}</div>
			<div v-if="user.isSilenced" class="punished"><i class="ti ti-alert-triangle" style="margin-right: 8px;"></i> {{ i18n.ts.userSilenced }}</div>

			<div class="profile _gaps">
				<MkAccountMoved v-if="user.movedTo" :movedTo="user.movedTo"/>
				<MkAccountMoved v-if="movedFromLog" :movedFrom="movedFromLog[0]?.movedFromId"/>
				<MkRemoteCaution v-if="user.host != null" :href="user.url ?? user.uri!" class="warn"/>

				<div :key="user.id" class="main _panel">
					<div class="banner-container" :style="style">
						<div ref="bannerEl" class="banner" :style="style"></div>
						<div class="fade"></div>
						<div class="title">
							<MkUserName class="name" :user="user" :nowrap="true"/>
							<div class="bottom">
								<span class="username"><MkAcct :user="user" :detail="true"/></span>
								<span v-if="user.isAdmin" :title="i18n.ts.isAdmin" style="color: var(--badge);"><i class="ti ti-shield"></i></span>
								<span v-if="user.isLocked" :title="i18n.ts.isLocked"><i class="ti ti-lock"></i></span>
								<span v-if="user.isBot" :title="i18n.ts.isBot"><i class="ti ti-robot"></i></span>
								<button v-if="$i && !isEditingMemo && !memoDraft" class="_button add-note-button" @click="showMemoTextarea">
									<i class="ti ti-edit"/> {{ i18n.ts.addMemo }}
								</button>
							</div>
						</div>
						<span v-if="$i && $i.id != user.id && user.isFollowed" class="followed">{{ i18n.ts.followsYou }}</span>
						<div v-if="$i" class="actions">
							<button class="menu _button" @click="menu"><i class="ti ti-dots"></i></button>
							<MkFollowButton v-if="$i.id != user.id" v-model:user="user" :inline="true" :transparent="false" :full="true" class="koudoku"/>
						</div>
					</div>
					<MkAvatar class="avatar" :user="user" indicator/>
					<div class="title">
						<MkUserName :user="user" :nowrap="false" class="name"/>
						<div class="bottom">
							<span class="username"><MkAcct :user="user" :detail="true"/></span>
							<span v-if="user.isAdmin" :title="i18n.ts.isAdmin" style="color: var(--badge);"><i class="ti ti-shield"></i></span>
							<span v-if="user.isLocked" :title="i18n.ts.isLocked"><i class="ti ti-lock"></i></span>
							<span v-if="user.isBot" :title="i18n.ts.isBot"><i class="ti ti-robot"></i></span>
						</div>
					</div>
					<div v-if="user.roles.length > 0" class="roles">
						<span v-for="role in user.roles" :key="role.id" v-tooltip="role.description" class="role" :style="{ '--color': role.color }">
							<MkA v-adaptive-bg :to="`/roles/${role.id}`">
								<img v-if="role.iconUrl" style="height: 1.3em; vertical-align: -22%;" :src="role.iconUrl"/>
								{{ role.name }}
							</MkA>
						</span>
					</div>
					<div v-if="iAmModerator" class="moderationNote">
						<MkTextarea v-if="editModerationNote || (moderationNote != null && moderationNote !== '')" v-model="moderationNote" manualSave>
							<template #label>{{ i18n.ts.moderationNote }}</template>
						</MkTextarea>
						<div v-else>
							<MkButton small @click="editModerationNote = true">{{ i18n.ts.addModerationNote }}</MkButton>
						</div>
					</div>
					<div v-if="isEditingMemo || memoDraft" class="memo" :class="{'no-memo': !memoDraft}">
						<div class="heading" v-text="i18n.ts.memo"/>
						<textarea
							ref="memoTextareaEl"
							v-model="memoDraft"
							rows="1"
							@focus="isEditingMemo = true"
							@blur="updateMemo"
							@input="adjustMemoTextarea"
						/>
					</div>
					<div class="description">
						<MkOmit>
							<Mfm v-if="user.description" :text="user.description" :isNote="false" :author="user"/>
							<p v-else class="empty">{{ i18n.ts.noAccountDescription }}</p>
						</MkOmit>
					</div>
					<MkContainer v-if="$i && $i.id == user.id && user?.mutualLinkSections?.slice(0, $i.policies.mutualLinkSectionLimit).length > 0" :showHeader="false" :max-height="200" class="fields" :style="{borderRadius: 0}">
						<div v-for="(section, index) in user?.mutualLinkSections.slice(0, $i.policies.mutualLinkSectionLimit)" :key="index" :class="$style.mutualLinkSections">
							<span v-if="section.name">{{ section.name }}</span>
							<div :class="$style.mutualLinks">
								<div v-for="mutualLink in section.mutualLinks.slice(0, $i.policies.mutualLinkLimit)" :key="mutualLink.id">
									<MkLink :hideIcon="true" :url="mutualLink.url">
										<img :class="$style.mutualLinkImg" :src="mutualLink.imgSrc" :alt="mutualLink.description"/>
									</MkLink>
								</div>
							</div>
						</div>
					</MkContainer>
					<MkContainer v-else-if="user?.mutualLinkSections?.length > 0" :showHeader="false" :max-height="200" class="fields" :style="{borderRadius: 0}">
						<div v-for="(section, index) in user?.mutualLinkSections" :key="index" :class="$style.mutualLinkSections">
							<span v-if="section.name">{{ section.name }}</span>
							<div :class="$style.mutualLinks">
								<div v-for="mutualLink in section.mutualLinks" :key="mutualLink.id">
									<MkLink :hideIcon="true" :url="mutualLink.url">
										<img :class="$style.mutualLinkImg" :src="mutualLink.imgSrc" :alt="mutualLink.description"/>
									</MkLink>
								</div>
							</div>
						</div>
					</MkContainer>
					<div class="fields system">
						<dl v-if="user.location" class="field">
							<dt class="name"><i class="ti ti-map-pin ti-fw"></i> {{ i18n.ts.location }}</dt>
							<dd class="value">{{ user.location }}</dd>
						</dl>
						<dl v-if="user.birthday" class="field">
							<dt class="name"><i class="ti ti-cake ti-fw"></i> {{ i18n.ts.birthday }}</dt>
							<dd class="value">{{ user.birthday.replace('-', '/').replace('-', '/') }} ({{ i18n.tsx.yearsOld({ age }) }})</dd>
						</dl>
						<dl class="field">
							<dt class="name"><i class="ti ti-calendar ti-fw"></i> {{ i18n.ts.registeredDate }}</dt>
							<dd class="value">{{ dateString(user.createdAt) }} (<MkTime :time="user.createdAt"/>)</dd>
						</dl>
					</div>
					<div v-if="user.fields.length > 0 || userSkebStatus" class="fields">
						<dl v-for="(field, i) in user.fields" :key="i" class="field">
							<dt class="name">
								<Mfm :text="field.name" :plain="true" :colored="false"/>
							</dt>
							<dd class="value">
								<Mfm :text="field.value" :author="user" :colored="false"/>
								<i v-if="user.verifiedLinks.includes(field.value)" v-tooltip:dialog="i18n.ts.verifiedLink" class="ti ti-circle-check" :class="$style.verifiedLink"></i>
							</dd>
						</dl>
						<dl v-if="userSkebStatus" class="field">
							<dt class="name">
								<a href="https://skeb.jp/" target="_blank" rel="noopener" style="display: flex; gap: 2px; align-items: center; justify-content: center;">
									<!--
										*** LICENSE NOTICE ***
										* This SVG is derived from the https://skeb.jp/ website, All rights reserved to *Skeb Inc.* https://skeb.co.jp/
										* This resource SHOULD NOT be considered as a part of this project that has licensed under AGPL-3.0-only
									-->
									<svg class="ti ti-fw" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
										<linearGradient id="a" x1="14.645309%" x2="85.354691%" y1="14.645309%" y2="85.363492%">
											<stop offset=".2" stop-color="#30b396"/>
											<stop offset="1" stop-color="#1e5e71"/>
										</linearGradient>
										<g fill="none">
											<circle cx="19.99375" cy="19.98125" fill="url(#a)" r="17.753125"/>
											<path d="m18.784375 13.9875-7.35625 21.546875c-.8125-.446875-1.58125-.959375-2.309375-1.525l1.134375-3.26875-2.528125-.86875.859375-2.56875 2.528125.86875 1.728125-5.05625-2.528125-.86875.86875-2.5375 2.528125.86875 1.728125-5.05625-2.528125-.86875.86875-2.5375 2.528125.86875 1.6875-4.99375-2.496875-.909375.440625-1.26875 5.05625 1.728125-.378125 1.1-1.76875 5.184375-.059375.159375zm-12.996875 16.640625c.6625.884375 1.40625 1.703125 2.21875 2.446875l.51875-1.515625zm3.29375-13.01875 3.8 1.296875.865625-2.534375-3.8-1.296875zm-2.590625 7.590625 3.8 1.296875.865625-2.534375-3.8-1.296875zm31.259375-5.21875c0-2.534375-.534375-4.940625-1.490625-7.11875l-13.325-4.559375-9.603125 28.134375c2.059375.834375 4.30625 1.3 6.665625 1.3 9.80625 0 17.753125-7.946875 17.753125-17.753125zm-26.071875-9.971875 3.8 1.296875.865625-2.534375-3.8-1.296875z" fill="#fff"/><path d="m19.99375 2.23125c9.80625 0 17.753125 7.946875 17.753125 17.753125s-7.946875 17.753125-17.753125 17.753125-17.753125-7.946875-17.753125-17.753125 7.946875-17.753125 17.753125-17.753125m0-2.228125c-11.034375 0-19.98125 8.946875-19.98125 19.98125s8.946875 19.98125 19.98125 19.98125 19.98125-8.946875 19.98125-19.98125-8.946875-19.98125-19.98125-19.98125z" fill="#1e5e71"/>
										</g>
									</svg>
									<span>Skeb</span>
									<i class="ti ti-external-link" style="font-size: .9em;"></i>
								</a>
							</dt>
							<dd class="value">
								<a :href="`https://skeb.jp/@${userSkebStatus.screenName}`" target="_blank" rel="noopener" style="display: flex; gap: 2px; align-items: center;">
									<span v-if="userSkebStatus.isAcceptable" :class="$style.skebAcceptable">
										{{ i18n.ts._skebStatus.seeking }}
									</span>
									<span v-else-if="userSkebStatus.isCreator" :class="$style.skebStopped">
										{{ i18n.ts._skebStatus.stopped }}
									</span>
									<span v-else :class="$style.skebClient">
										{{ i18n.ts._skebStatus.client }}
									</span>
									<Mfm :text="buildSkebStatus()" :author="user" :nyaize="false" :colored="false"/>
									<i class="ti ti-external-link" style="font-size: .9em;"></i>
								</a>
							</dd>
						</dl>
					</div>

					<div class="status">
						<MkA :to="userPage(user)">
							<b>{{ number(user.notesCount) }}</b>
							<span>{{ i18n.ts.notes }}</span>
						</MkA>
						<MkA v-if="isFollowingVisibleForMe(user)" :to="userPage(user, 'following')">
							<b>{{ number(user.followingCount) }}</b>
							<span>{{ i18n.ts.following }}</span>
						</MkA>
						<MkA v-if="isFollowersVisibleForMe(user)" :to="userPage(user, 'followers')">
							<b>{{ number(user.followersCount) }}</b>
							<span>{{ i18n.ts.followers }}</span>
						</MkA>
					</div>
				</div>
			</div>

			<div class="contents _gaps">
				<div v-if="user.pinnedNotes.length > 0" class="_gaps">
					<MkNote v-for="note in user.pinnedNotes" :key="note.id" class="note _panel" :note="note" :pinned="true"/>
				</div>
				<MkInfo v-else-if="$i && $i.id === user.id">{{ i18n.ts.userPagePinTip }}</MkInfo>
				<template v-if="narrow">
					<MkLazy>
						<XFiles :key="user.id" :user="user"/>
					</MkLazy>
					<MkLazy>
						<XActivity :key="user.id" :user="user"/>
					</MkLazy>
				</template>
				<div v-if="!disableNotes">
					<MkLazy>
						<XTimeline :user="user"/>
					</MkLazy>
				</div>
			</div>
		</div>
		<div v-if="!narrow" class="sub _gaps" style="container-type: inline-size;">
			<XFiles :key="user.id" :user="user"/>
			<XActivity :key="user.id" :user="user"/>
		</div>
	</div>
</MkSpacer>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, computed, onMounted, onUnmounted, nextTick, watch, ref } from 'vue';
import * as Misskey from 'misskey-js';
import MkNote from '@/components/MkNote.vue';
import MkFollowButton from '@/components/MkFollowButton.vue';
import MkAccountMoved from '@/components/MkAccountMoved.vue';
import MkRemoteCaution from '@/components/MkRemoteCaution.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkOmit from '@/components/MkOmit.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkButton from '@/components/MkButton.vue';
import { getScrollPosition } from '@/scripts/scroll.js';
import { getUserMenu } from '@/scripts/get-user-menu.js';
import number from '@/filters/number.js';
import { userPage } from '@/filters/user.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { $i, iAmModerator } from '@/account.js';
import { dateString } from '@/filters/date.js';
import { confetti } from '@/scripts/confetti.js';
import { misskeyApi, misskeyApiGet } from '@/scripts/misskey-api.js';
import { isFollowingVisibleForMe, isFollowersVisibleForMe } from '@/scripts/isFfVisibleForMe.js';
import { useRouter } from '@/router/supplier.js';
import MkLink from '@/components/MkLink.vue';
import MkContainer from '@/components/MkContainer.vue';

function calcAge(birthdate: string): number {
	const date = new Date(birthdate);
	const now = new Date();

	let yearDiff = now.getFullYear() - date.getFullYear();
	const monthDiff = now.getMonth() - date.getMonth();
	const pastDate = now.getDate() < date.getDate();

	if (monthDiff < 0 || (monthDiff === 0 && pastDate)) {
		yearDiff--;
	}

	return yearDiff;
}

const XFiles = defineAsyncComponent(() => import('./index.files.vue'));
const XActivity = defineAsyncComponent(() => import('./index.activity.vue'));
const XTimeline = defineAsyncComponent(() => import('./index.timeline.vue'));

const props = withDefaults(defineProps<{
	user: Misskey.entities.UserDetailed;
	/** Test only; MkNotes currently causes problems in vitest */
	disableNotes: boolean;
}>(), {
	disableNotes: false,
});

const router = useRouter();

const user = ref(props.user);
const userSkebStatus = ref<Misskey.Endpoints['users/get-skeb-status']['res'] | null>(null);
const parallaxAnimationId = ref<null | number>(null);
const narrow = ref<null | boolean>(null);
const rootEl = ref<null | HTMLElement>(null);
const bannerEl = ref<null | HTMLElement>(null);
const memoTextareaEl = ref<null | HTMLElement>(null);
const memoDraft = ref(props.user.memo);
const isEditingMemo = ref(false);
const moderationNote = ref(props.user.moderationNote);
const editModerationNote = ref(false);
const movedFromLog = ref<null | {movedFromId:string;}[]>(null);

watch(moderationNote, async () => {
	await misskeyApi('admin/update-user-note', { userId: props.user.id, text: moderationNote.value });
});

const style = computed(() => {
	if (props.user.bannerUrl == null) return {};
	return {
		backgroundImage: `url(${ props.user.bannerUrl })`,
	};
});

const age = computed(() => {
	return calcAge(props.user.birthday);
});

function menu(ev: MouseEvent) {
	const { menu, cleanup } = getUserMenu(user.value, router);
	os.popupMenu(menu, ev.currentTarget ?? ev.target).finally(cleanup);
}

async function fetchMovedFromLog() {
	if (!props.user.id) {
		movedFromLog.value = null;
		return;
	}

	movedFromLog.value = await misskeyApi('admin/show-user-account-move-logs', { movedToId: props.user.id });
}

function parallaxLoop() {
	parallaxAnimationId.value = window.requestAnimationFrame(parallaxLoop);
	parallax();
}

function parallax() {
	const banner = bannerEl.value as any;
	if (banner == null) return;

	const top = getScrollPosition(rootEl.value);

	if (top < 0) return;

	const z = 1.75; // 奥行き(小さいほど奥)
	const pos = -(top / z);
	banner.style.backgroundPosition = `center calc(50% - ${pos}px)`;
}

function showMemoTextarea() {
	isEditingMemo.value = true;
	nextTick(() => {
		memoTextareaEl.value?.focus();
	});
}

function adjustMemoTextarea() {
	if (!memoTextareaEl.value) return;
	memoTextareaEl.value.style.height = '0px';
	memoTextareaEl.value.style.height = `${memoTextareaEl.value.scrollHeight}px`;
}

async function updateMemo() {
	await misskeyApi('users/update-memo', {
		memo: memoDraft.value,
		userId: props.user.id,
	});
	isEditingMemo.value = false;
}

async function fetchSkebStatus() {
	if (!instance.enableSkebStatus || !props.user.id) {
		userSkebStatus.value = null;
		return;
	}

	try {
		userSkebStatus.value = await misskeyApiGet('users/get-skeb-status', { userId: props.user.id });
	} catch {
		userSkebStatus.value = null;
	}
}

function buildSkebStatus(): string {
	if (!userSkebStatus.value) return '';

	if (userSkebStatus.value.isAcceptable || userSkebStatus.value.isCreator) {
		let status = '';

		if (userSkebStatus.value.isAcceptable) {
			status += `${i18n.ts._skebStatus._genres[userSkebStatus.value.skills[0].genre]} ${i18n.tsx._skebStatus.yenX({ x: userSkebStatus.value.skills[0].amount.toLocaleString() })}`;
		}

		if (userSkebStatus.value.creatorRequestCount > 0) {
			if (userSkebStatus.value.isAcceptable) {
				status += ' | ';
			}
			status += i18n.tsx._skebStatus.nWorks({ n: userSkebStatus.value.creatorRequestCount.toLocaleString() });
		}

		return status;
	} else if (userSkebStatus.value.clientRequestCount > 0) {
		return i18n.tsx._skebStatus.nRequests({ n: userSkebStatus.value.clientRequestCount.toLocaleString() });
	}

	return '';
}

watch([props.user], () => {
	memoDraft.value = props.user.memo;
	fetchSkebStatus();
	if ($i?.isModerator) {
		fetchMovedFromLog();
	}
});

onMounted(() => {
	window.requestAnimationFrame(parallaxLoop);
	narrow.value = rootEl.value!.clientWidth < 1000;

	if (props.user.birthday) {
		const m = new Date().getMonth() + 1;
		const d = new Date().getDate();
		const bm = parseInt(props.user.birthday.split('-')[1]);
		const bd = parseInt(props.user.birthday.split('-')[2]);
		if (m === bm && d === bd) {
			confetti({
				duration: 1000 * 4,
			});
		}
	}
	fetchSkebStatus();
	if ($i?.isModerator) {
		fetchMovedFromLog();
	}
	nextTick(() => {
		adjustMemoTextarea();
	});
});

onUnmounted(() => {
	if (parallaxAnimationId.value) {
		window.cancelAnimationFrame(parallaxAnimationId.value);
	}
});
</script>

<style lang="scss" scoped>
.ftskorzw {

	> .main {

		> .punished {
			font-size: 0.8em;
			padding: 16px;
			background: var(--infoWarnBg);
			color: var(--infoWarnFg);
			border-radius: var(--radius);
			overflow: clip;
		}

		> .profile {

			> .main {
				position: relative;
				overflow: clip;

				> .banner-container {
					position: relative;
					height: 250px;
					overflow: clip;
					background-size: cover;
					background-position: center;

					> .banner {
						height: 100%;
						background-color: #4c5e6d;
						background-size: cover;
						background-position: center;
						box-shadow: 0 0 128px rgba(0, 0, 0, 0.5) inset;
						will-change: background-position;
					}

					> .fade {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						height: 78px;
						background: linear-gradient(transparent, rgba(#000, 0.7));
					}

					> .followed {
						position: absolute;
						top: 12px;
						left: 12px;
						padding: 4px 8px;
						color: #fff;
						background: rgba(0, 0, 0, 0.7);
						font-size: 0.7em;
						border-radius: 6px;
					}

					> .actions {
						position: absolute;
						top: 12px;
						right: 12px;
						-webkit-backdrop-filter: var(--blur, blur(8px));
						backdrop-filter: var(--blur, blur(8px));
						background: rgba(0, 0, 0, 0.2);
						padding: 8px;
						border-radius: 24px;

						> .menu {
							vertical-align: bottom;
							height: 31px;
							width: 31px;
							color: #fff;
							text-shadow: 0 0 8px #000;
							font-size: 16px;
						}

						> .koudoku {
							margin-left: 4px;
							vertical-align: bottom;
						}
					}

					> .title {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						padding: 0 0 8px 154px;
						box-sizing: border-box;
						color: #fff;

						> .name {
							display: block;
							margin: 0;
							line-height: 32px;
							font-weight: bold;
							font-size: 1.8em;
							text-shadow: 0 0 8px #000;
						}

						> .bottom {
							> * {
								display: inline-block;
								margin-right: 16px;
								line-height: 20px;
								opacity: 0.8;

								&.username {
									font-weight: bold;
								}
							}

							> .add-note-button {
								background: rgba(0, 0, 0, 0.2);
								color: #fff;
								-webkit-backdrop-filter: var(--blur, blur(8px));
								backdrop-filter: var(--blur, blur(8px));
								border-radius: 24px;
								padding: 4px 8px;
								font-size: 80%;
							}
						}
					}
				}

				> .title {
					display: none;
					text-align: center;
					padding: 50px 8px 16px 8px;
					font-weight: bold;
					border-bottom: solid 0.5px var(--divider);

					> .bottom {
						> * {
							display: inline-block;
							margin-right: 8px;
							opacity: 0.8;
						}
					}
				}

				> .avatar {
					display: block;
					position: absolute;
					top: 170px;
					left: 16px;
					z-index: 2;
					width: 120px;
					height: 120px;
					box-shadow: 1px 1px 3px rgba(#000, 0.2);
				}

				> .roles {
					padding: 24px 24px 0 154px;
					font-size: 0.95em;
					display: flex;
					flex-wrap: wrap;
					gap: 8px;

					> .role {
						border: solid 1px var(--color, var(--divider));
						border-radius: 999px;
						margin-right: 4px;
						padding: 3px 8px;
					}
				}

				> .moderationNote {
					margin: 12px 24px 0 154px;
				}

				> .memo {
					margin: 12px 24px 0 154px;
					background: transparent;
					color: var(--fg);
					border: 1px solid var(--divider);
					border-radius: 8px;
					padding: 8px;
					line-height: 0;

					> .heading {
						text-align: left;
						color: var(--fgTransparent);
						line-height: 1.5;
						font-size: 85%;
					}

					textarea {
						margin: 0;
						padding: 0;
						resize: none;
						border: none;
						outline: none;
						width: 100%;
						height: auto;
						min-height: 0;
						line-height: 1.5;
						color: var(--fg);
						overflow: hidden;
						background: transparent;
						font-family: inherit;
					}
				}

				> .description {
					padding: 24px 24px 24px 154px;
					font-size: 0.95em;

					> .empty {
						margin: 0;
						opacity: 0.5;
					}
				}

				> .fields {
					padding: 24px;
					font-size: 0.9em;
					border-top: solid 0.5px var(--divider);
					margin-top: 0.5px;

					> .field {
						display: flex;
						padding: 0;
						margin: 0;
						align-items: center;

						&:not(:last-child) {
							margin-bottom: 8px;
						}

						> .name {
							width: 30%;
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							font-weight: bold;
							text-align: center;
						}

						> .value {
							width: 70%;
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							margin: 0;
						}
					}

					&.system > .field > .name {
					}
				}

				> .status {
					display: flex;
					padding: 24px;
					border-top: solid 0.5px var(--divider);

					> a {
						flex: 1;
						text-align: center;

						&.active {
							color: var(--accent);
						}

						&:hover {
							text-decoration: none;
						}

						> b {
							display: block;
							line-height: 16px;
						}

						> span {
							font-size: 70%;
						}
					}
				}
			}
		}

		> .contents {
			> .content {
				margin-bottom: var(--margin);
			}
		}
	}

	&.wide {
		display: flex;
		width: 100%;

		> .main {
			width: 100%;
			min-width: 0;
		}

		> .sub {
			max-width: 350px;
			min-width: 350px;
			margin-left: var(--margin);
		}
	}
}

@container (max-width: 500px) {
	.ftskorzw {
		> .main {
			> .profile > .main {
				> .banner-container {
					height: 140px;

					> .fade {
						display: none;
					}

					> .title {
						display: none;
					}
				}

				> .title {
					display: block;
				}

				> .avatar {
					top: 90px;
					left: 0;
					right: 0;
					width: 92px;
					height: 92px;
					margin: auto;
				}

				> .roles {
					padding: 16px 16px 0 16px;
					justify-content: center;
				}

				> .moderationNote {
					margin: 16px 16px 0 16px;
				}

				> .memo {
					margin: 16px 16px 0 16px;
				}

				> .description {
					padding: 16px;
					text-align: center;
				}

				> .fields {
					padding: 16px;
				}

				> .status {
					padding: 16px;
				}
			}

			> .contents {
				> .nav {
					font-size: 80%;
				}
			}
		}
	}
}
</style>

<style lang="scss" module>
.tl {
	background: var(--bg);
	border-radius: var(--radius);
	overflow: clip;
}

.verifiedLink {
	margin-left: 4px;
	color: var(--success);
}

.skebAcceptable,
.skebStopped,
.skebClient {
	display: inline-flex;
	border: solid 1px;
	border-radius: 6px;
	padding: 2px 6px;
	margin-right: 4px;
	font-size: 85%;
}

.skebAcceptable {
	color: rgb(255, 255, 255);
	background-color: rgb(241, 70, 104);
}

.skebStopped {
	color: rgb(255, 255, 255);
	background-color: rgb(54, 54, 54);
}

.skebClient {
	color: rgb(255, 255, 255);
	background-color: rgb(54, 54, 54);
}

.mutualLinkSections {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-around;
	flex-direction: column;
	background: var(--panel);
	gap: 8px;
	margin-bottom: 8px;

}

.mutualLinks {
	display: flex;
	justify-content: space-around;
	flex-wrap: wrap;
	gap: 12px;
	padding-top: 8px;
	@media (max-width: 500px) {
		gap: 8px;
	}
}

.mutualLink {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.mutualLinkImg {
	max-width: 200px;
	max-height: 40px;
}
</style>
