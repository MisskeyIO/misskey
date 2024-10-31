<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :contentMax="1000" :marginMin="16" :marginMax="32">
		<div class="_root">
			<Transition :name="defaultStore.state.animation ? 'fade' : ''" mode="out-in">
				<div v-if="post" class="rkxwuolj">
					<div v-if="!bookMode" class="files">
						<div v-for="file in post.files" :key="file.id" class="file">
							<img :src="file.url" />
						</div>
					</div>
					<div v-if="bookMode" style="display: grid; justify-content: center; align-items: center;">
						<Teleport to="body">
							<div v-if="fullscreen" class="magazine-fullscreen-bg">
								<MkButton v-if="fullscreen" :rounded="true"
									style="position:fixed;top:10px;right:10px;" @click="closeFullscreen">
									<i class="ti ti-x"></i>
								</MkButton>
								<div class="magazine-fullscreen-outer">
									<TurnView :options="isMobile ? bookOptionsMobile : bookOptions"
										class="magazine-fullscreen">
										<div v-for="file in post.files" :key="file.id"
											class="magazine-page-img-outer">
											<img :src="file.url" class="magazine-page-img-fullscreen" />
										</div>
									</TurnView>
								</div>
							</div>
						</Teleport>
						<TurnView v-if="!fullscreen"
							:class="isMobile ? 'magazine-mobile' : bookModeDouble ? 'magazine-double' : 'magazine-single'"
							:options="isMobile ? bookOptionsMobile : bookOptions">
							<div v-for="file in post.files" :key="file.id" class="magazine-page-img-outer">
								<img :src="file.url" class="magazine-page-img" />
							</div>
						</TurnView>
					</div>
					<div class="body">
						<div class="title">{{ post.title }}</div>
						<div class="description"><Mfm :text="post.description"/></div>
						<div class="info">
							<i class="ti ti-clock"></i> <MkTime :time="post.createdAt" mode="detail"/>
						</div>
						<div class="actions">
							<div class="like">
								<MkButton v-if="post.isLiked" v-tooltip="i18n.ts._gallery.unlike" class="button" primary @click="unlike()"><i class="ti ti-heart-off"></i><span v-if="post.likedCount > 0" class="count">{{ post.likedCount }}</span></MkButton>
								<MkButton v-else v-tooltip="i18n.ts._gallery.like" class="button" @click="like()"><i class="ti ti-heart"></i><span v-if="post.likedCount > 0" class="count">{{ post.likedCount }}</span></MkButton>
							</div>
							<div class="other">
								<button v-if="$i && $i.id === post.user.id" v-tooltip="i18n.ts.edit" v-click-anime class="_button" @click="edit"><i class="ti ti-pencil ti-fw"></i></button>
								<button v-tooltip="i18n.ts.shareWithNote" v-click-anime class="_button" @click="shareWithNote"><i class="ti ti-repeat ti-fw"></i></button>
								<button v-tooltip="i18n.ts.copyLink" v-click-anime class="_button" @click="copyLink"><i class="ti ti-link ti-fw"></i></button>
								<button v-if="isSupportShare()" v-tooltip="i18n.ts.share" v-click-anime class="_button" @click="share"><i class="ti ti-share ti-fw"></i></button>
							</div>
						</div>
						<div class="user">
							<MkAvatar :user="post.user" class="avatar" link preview/>
							<div class="name">
								<MkUserName :user="post.user" style="display: block;"/>
								<MkAcct :user="post.user"/>
							</div>
							<MkFollowButton v-if="!$i || $i.id != post.user.id" v-model:user="post.user" :inline="true" :transparent="false" :full="true" large class="koudoku"/>
						</div>
					</div>
					<MkAd :prefer="['square', 'horizontal', 'horizontal-big']"/>
					<MkContainer :max-height="300" :foldable="true" class="other">
						<template #icon><i class="ti ti-clock"></i></template>
						<template #header>{{ i18n.ts.recentPosts }}</template>
						<MkPagination v-slot="{items}" :pagination="otherPostsPagination">
							<div class="sdrarzaf">
								<MkGalleryPostPreview v-for="post in items" :key="post.id" :post="post" class="post"/>
							</div>
						</MkPagination>
					</MkContainer>
				</div>
				<MkError v-else-if="error" @retry="fetchPost()"/>
				<MkLoading v-else/>
			</Transition>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, watch, ref } from 'vue';
import * as Misskey from 'misskey-js';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/scripts/misskey-api.js';
import MkContainer from '@/components/MkContainer.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkGalleryPostPreview from '@/components/MkGalleryPostPreview.vue';
import MkFollowButton from '@/components/MkFollowButton.vue';
import { url } from '@/config.js';
import { i18n } from '@/i18n.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import { defaultStore } from '@/store.js';
import { $i } from '@/account.js';
import { isSupportShare } from '@/scripts/navigator.js';
import copyToClipboard from '@/scripts/copy-to-clipboard.js';
import { useRouter } from '@/router/supplier.js';

const router = useRouter();

const props = defineProps<{
	postId: string;
}>();

const post = ref<Misskey.entities.GalleryPost | null>(null);
const error = ref<any>(null);
const bookMode = ref(false);
const fullscreen = ref(false);
const switchFullscreen = () => {
	fullscreen.value = true;
}
const closeFullscreen = () => {
	fullscreen.value = false;
}

const MOBILE_THRESHOLD = 500;
const isMobile = ref(window.innerWidth <= 500);
window.addEventListener('resize', () => {
	isMobile.value = window.innerWidth <= 500;
});

const bookOptionsDefault = {
	display: "double",
	acceleration: true,
	elevation: 50,
};

const bookOptions = ref(bookOptionsDefault);

const bookOptionsMobileDefault = {
	display: "single",
	acceleration: true,
	elevation: 50,
};

const bookOptionsMobile = ref(bookOptionsMobileDefault);
const bookModeDouble = ref(true);
const otherPostsPagination = {
	endpoint: 'users/gallery/posts' as const,
	limit: 6,
	params: computed(() => ({
		userId: post.value.user.id,
	})),
};

function fetchPost() {
	post.value = null;
	misskeyApi('gallery/posts/show', {
		postId: props.postId,
	}).then(_post => {
		post.value = _post;
		if (_post.viewSettings) {
			bookMode.value = _post.viewSettings.initialMode === "BOOK";
			bookModeDouble.value = _post.viewSettings.double;
			bookOptions.value = Object.assign(bookOptionsDefault, {
				display: _post.viewSettings.double ? "double" : "single",
				direction: _post.viewSettings.rightOpening ? "rtl" : undefined,
			});
			bookOptionsMobile.value = Object.assign(bookOptionsMobileDefault, {
				direction: _post.viewSettings.rightOpening ? "rtl" : undefined,
			});
		} else {
			bookMode.value = false;
			bookOptions.value = Object.assign(bookOptionsDefault, {
				direction: "rtl"
			});
			bookOptionsMobile.value = Object.assign(bookOptionsMobileDefault, {
				direction: "rtl"
			});
		}
	}).catch(_error => {
		error.value = _error;
	});
}

function copyLink() {
	copyToClipboard(`${url}/gallery/${post.value.id}`);
	os.success();
}

function share() {
	navigator.share({
		title: post.value.title,
		text: post.value.description,
		url: `${url}/gallery/${post.value.id}`,
	});
}

function shareWithNote() {
	os.post({
		initialText: `${post.value.title} ${url}/gallery/${post.value.id}`,
	});
}

function like() {
	os.apiWithDialog('gallery/posts/like', {
		postId: props.postId,
	}).then(() => {
		post.value.isLiked = true;
		post.value.likedCount++;
	});
}

async function unlike() {
	const confirm = await os.confirm({
		type: 'warning',
		text: i18n.ts.unlikeConfirm,
	});
	if (confirm.canceled) return;
	os.apiWithDialog('gallery/posts/unlike', {
		postId: props.postId,
	}).then(() => {
		post.value.isLiked = false;
		post.value.likedCount--;
	});
}

function edit() {
	router.push(`/gallery/${post.value.id}/edit`);
}

watch(() => props.postId, fetchPost, { immediate: true });

const headerActions = computed(() => [
	...((bookMode.value) ? [{
		icon: "ti ti-book-off",
		handler: () => { bookMode.value = false },
	}] : [{
		icon: "ti ti-book",
		handler: () => { bookMode.value = true },
	}]),
	...((isMobile.value) ? [] : bookMode.value ? [{
		icon: "ti ti-maximize",
		text: i18n.ts.fullView,
		handler: switchFullscreen,
	}] : []),
	{
		icon: 'ti ti-pencil',
		text: i18n.ts.edit,
		handler: edit,
	}
]);

const headerTabs = computed(() => []);

definePageMetadata(() => ({
	title: post.value ? post.value.title : i18n.ts.gallery,
	...post.value ? {
		avatar: post.value.user,
	} : {},
}));
</script>

<style lang="scss" scoped>
.magazine-double {
	background-color: #fff;
	display: block;
	max-width: 100%;
	max-height: 600px;
	margin: 0 auto;
}

.magazine-single {
	background-color: #fff;
	display: block;
	max-width: 80%;
	max-height: 600px;
	margin: 0 auto;
}

.magazine-mobile {
	background-color: #fff;
	display: block;
	max-width: 100%;
	max-height: 600px;
	margin: 0 auto;
}

.magazine-page-img-outer {
	background-color: #fff;
	display: grid;
	justify-content: center;
	align-items: center;
}

.magazine-page-img {
	user-select: none;
	max-width: 100%;
	max-height: 600px;
}

.magazine-page-img-fullscreen {
	user-select: none;
	max-width: 100%;
	max-height: 95%;
}

.magazine .turn-page {
	background-color: #ccc;
	background-size: 100% 100%;
}

.magazine-fullscreen-bg {
	z-index: 1000;
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: #000;
}

.magazine-fullscreen-outer {
	display: grid;
	justify-content: center;
	align-items: center;
}

.magazine-fullscreen {
	background-color: #fff;
	width: 141dvh;
	height: 100dvh;
}

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.125s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.rkxwuolj {
	> .files {
		> .file {
			> img {
				display: block;
				max-width: 100%;
				max-height: 500px;
				margin: 0 auto;
			}

			& + .file {
				margin-top: 16px;
			}
		}
	}

	> .body {
		padding: 32px;

		> .title {
			font-weight: bold;
			font-size: 1.2em;
			margin-bottom: 16px;
		}

		> .info {
			margin-top: 16px;
			font-size: 90%;
			opacity: 0.7;
		}

		> .actions {
			display: flex;
			align-items: center;
			margin-top: 16px;
			padding: 16px 0 0 0;
			border-top: solid 0.5px var(--divider);

			> .like {
				> .button {
					--accent: rgb(241 97 132);
					--X8: rgb(241 92 128);
					--buttonBg: rgb(216 71 106 / 5%);
					--buttonHoverBg: rgb(216 71 106 / 10%);
					color: #ff002f;

					::v-deep(.count) {
						margin-left: 0.5em;
					}
				}
			}

			> .other {
				margin-left: auto;

				> button {
					padding: 8px;
					margin: 0 8px;

					&:hover {
						color: var(--fgHighlighted);
					}
				}
			}
		}

		> .user {
			margin-top: 16px;
			padding: 16px 0 0 0;
			border-top: solid 0.5px var(--divider);
			display: flex;
			align-items: center;
			flex-wrap: wrap;

			> .avatar {
				width: 52px;
				height: 52px;
			}

			> .name {
				margin: 0 0 0 12px;
				font-size: 90%;
			}

			> .koudoku {
				margin-left: auto;
			}
		}
	}
}

.sdrarzaf {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	grid-gap: 12px;
	margin: var(--margin);

	> .post {

	}
}
</style>
