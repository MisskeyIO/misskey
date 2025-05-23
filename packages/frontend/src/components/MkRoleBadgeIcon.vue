<template>
<img ref="el" :src="role.iconUrl!" :style="style" @click="onClick(role)"/>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { instance } from '@/instance.js';
import { misskeyApiGet } from '@/scripts/misskey-api.js';
import { useTooltip } from '@/scripts/use-tooltip.js';

const props = defineProps<{
	userId: string,
	role: { name: string, iconUrl: string | null, displayOrder: number, behavior?: string }
}>();

const el = ref<HTMLElement | { $el: HTMLElement }>();
const userSkebStatus = ref<Misskey.Endpoints['users/get-skeb-status']['res'] | null>(null);

async function fetchSkebStatus() {
	if (!instance.enableSkebStatus || props.role.behavior !== 'skeb') {
		userSkebStatus.value = null;
		return;
	}

	try {
		userSkebStatus.value = await misskeyApiGet('users/get-skeb-status', { userId: props.userId });
	} catch {
		userSkebStatus.value = null;
	}
}

if (props.role.behavior === 'skeb') {
	useTooltip(el, async (showing) => {
		if (userSkebStatus.value === null) {
			await fetchSkebStatus();
		}

		if (userSkebStatus.value === null) return;

		os.popup(defineAsyncComponent(() => import('@/components/MkSkebStatusPopup.vue')), {
			showing,
			skebStatus: userSkebStatus.value,
			source: el.value instanceof HTMLElement ? el.value : el.value?.$el,
		}, {}, 'closed');
	});
}

const style = computed(() => {
	if (props.role.behavior === 'skeb' && userSkebStatus.value !== null) {
		return 'cursor: pointer;';
	} else {
		return undefined;
	}
});

async function onClick(role: { name: string, iconUrl: string | null, displayOrder: number, behavior?: string }) {
	if (role.behavior === 'skeb') {
		if (userSkebStatus.value === null) {
			await fetchSkebStatus();
		}

		if (userSkebStatus.value !== null) {
			window.open(`https://skeb.jp/@${userSkebStatus.value.screenName}`, '_blank', 'noopener');
		}
	}
}
</script>
