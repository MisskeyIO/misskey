<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<XBanner v-for="media in bannerMediaList" :key="media.id" :media="media" :user="user"/>
	<div v-if="count > 0" :class="$style.container">
		<div
			ref="gallery"
			:class="[
				$style.medias,
				...(prefer.s.showMediaListByGridInWideArea ? [$style.gridInWideArea] : []),
				count === 1 ? [$style.n1, {
					[$style.n116_9]: prefer.s.mediaListWithOneImageAppearance === '16_9',
					[$style.n11_1]: prefer.s.mediaListWithOneImageAppearance === '1_1',
					[$style.n12_3]: prefer.s.mediaListWithOneImageAppearance === '2_3',
				}] : count === 2 ? $style.n2 : count === 3 ? $style.n3 : count === 4 ? $style.n4 : $style.nMany,
			]"
		>
			<template v-for="media in previewableMediaList">
				<XVideo
					v-if="media.type.startsWith('video')"
					:key="`video:${media.id}`"
					:class="$style.media"
					:video="media"
					@mediaClick="onMediaClick(media)"
				/>
				<XImage
					v-else-if="media.type.startsWith('image')"
					:key="`image:${media.id}`"
					:marker="`${markerId}:${media.id}`"
					:disableImageLink="true"
					:class="$style.media"
					:image="media"
					:raw="raw"
					@mediaClick="onMediaClick(media)"
				/>
			</template>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, markRaw, onMounted, watch, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import { FILE_TYPE_BROWSERSAFE } from '@@/js/const.js';
import type { Content } from '@/components/MkLightbox.item.vue';
import XBanner from '@/components/MkMediaBanner.vue';
import XImage from '@/components/MkMediaImage.vue';
import XVideo from '@/components/MkMediaVideo.vue';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { genId } from '@/utility/id.js';
import { isFileBlocked, canRevealFile } from '@/utility/sensitive-file.js';
import { sensitiveContentConsent } from '@/utility/sensitive-content-consent.js';

const props = defineProps<{
	mediaList: Misskey.entities.DriveFile[];
	raw?: boolean;
	user?: Misskey.entities.UserLite;
}>();

const gallery = useTemplateRef('gallery');
const bannerMediaList = computed(() => props.mediaList.filter(media => !isFileBlocked(media) && !previewable(media)));
const previewableMediaList = computed(() => props.mediaList.filter(media => !isFileBlocked(media) && previewable(media)));
const count = computed(() => previewableMediaList.value.length);
const markerId = genId();

async function calcAspectRatio() {
	if (!gallery.value) return;

	const img = previewableMediaList.value[0];

	if (count.value !== 1 || !img || !(img.properties.width && img.properties.height)) {
		gallery.value.style.aspectRatio = '';
		return;
	}

	const ratioMax = (ratio: number) => {
		if (img.properties.width == null || img.properties.height == null) return '';
		return `${Math.max(ratio, img.properties.width / img.properties.height).toString()} / 1`;
	};

	switch (prefer.s.mediaListWithOneImageAppearance) {
		case '16_9':
			gallery.value.style.aspectRatio = ratioMax(16 / 9);
			break;
		case '1_1':
			gallery.value.style.aspectRatio = ratioMax(1 / 1);
			break;
		case '2_3':
			gallery.value.style.aspectRatio = ratioMax(2 / 3);
			break;
		default:
			gallery.value.style.aspectRatio = '';
			break;
	}
}

onMounted(() => {
	calcAspectRatio();
});

const previewable = (file: Misskey.entities.DriveFile): boolean => {
	if (file.type === 'image/svg+xml') return true; // svgのwebpublic/thumbnailはpngなのでtrue
	// FILE_TYPE_BROWSERSAFEに適合しないものはブラウザで表示するのに不適切
	return (file.type.startsWith('video') || file.type.startsWith('image')) && FILE_TYPE_BROWSERSAFE.includes(file.type);
};

watch(count, calcAspectRatio, { flush: 'post' });

async function onMediaClick(file: Misskey.entities.DriveFile) {
	if (isFileBlocked(file)) return;
	if (file.isSensitive && sensitiveContentConsent.value !== true && !(await canRevealFile(file))) return;

	if (prefer.s.imageNewTab) {
		window.open(file.url, '_blank');
		return;
	}
	openGallery(file.id, true);
}

async function openGallery(id?: string, alreadyRevealed = false) {
	if (id == null) {
		const firstImage = previewableMediaList.value[0];
		if (firstImage == null) return;
		id = firstImage.id;
	}
	const selected = previewableMediaList.value.find(media => media.id === id);
	if (selected == null) return;
	// キーボードから開く場合も、個別の表示確認を省略しない。
	if (!alreadyRevealed && !(await canRevealFile(selected))) return;

	const getElementByMarker = (marker: string) => {
		if (gallery.value == null) return null;
		const found = gallery.value.querySelector(`[data-marker="${marker}"]`) as HTMLElement | null;
		if (found == null) return null;
		return markRaw(found);
	};

	const contents = previewableMediaList.value.map<Content>(media => ({
		id: media.id,
		type: media.type.startsWith('video') ? 'video' : 'image',
		url: media.url,
		thumbnailUrl: media.thumbnailUrl,
		width: media.properties.width,
		height: media.properties.height,
		filename: media.name,
		file: media,
		initiallyRevealed: media.id === id,
		sourceElement: getElementByMarker(`${markerId}:${media.id}`),
	}));

	const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkLightbox.vue').then(x => x.default), {
		defaultIndex: contents.findIndex(conten => conten.id === id),
		contents: contents,
	}, {
		closed: () => dispose(),
	});
}

defineExpose({
	openGallery,
});
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;
}

.container {
	position: relative;
	width: 100%;
}

.medias {
	display: grid;
	grid-gap: 8px;

	height: 100%;
	width: 100%;

	&.n1 {
		grid-template-rows: 1fr;

		// default but fallback (expand)
		min-height: 64px;
		max-height: clamp(
			64px,
			50cqh,
			min(360px, 50vh)
		);

		&.n116_9 {
			min-height: initial;
			max-height: initial;
			aspect-ratio: 16 / 9; // fallback
		}

		&.n11_1{
			min-height: initial;
			max-height: initial;
			aspect-ratio: 1 / 1; // fallback
		}

		&.n12_3 {
			min-height: initial;
			max-height: initial;
			aspect-ratio: 2 / 3; // fallback
		}
	}

	&.n2 {
		aspect-ratio: 16/9;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr;
	}

	&.n3 {
		aspect-ratio: 16/9;
		grid-template-columns: 1fr 0.5fr;
		grid-template-rows: 1fr 1fr;

		> .media:nth-child(1) {
			grid-row: 1 / 3;
		}

		> .media:nth-child(3) {
			grid-column: 2 / 3;
			grid-row: 2 / 3;
		}
	}

	&.n4 {
		aspect-ratio: 16/9;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
	}

	&.nMany {
		grid-template-columns: 1fr 1fr;

		> .media {
			aspect-ratio: 16/9;
		}
	}
}

.media {
	overflow: hidden; // clipにするとバグる
	border-radius: 8px;
	cursor: zoom-in;
}

@container (min-width: 500px) {
	.medias.gridInWideArea {
		display: grid;
		aspect-ratio: auto;
		grid-template-columns: repeat(4, 1fr);
		grid-template-rows: auto;
		grid-gap: 8px;

		> .media {
			aspect-ratio: 1 / 1;
		}
	}
}
</style>
