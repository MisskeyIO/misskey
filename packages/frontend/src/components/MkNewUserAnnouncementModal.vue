<template>
<MkModal ref="modal" :zPriority="'middle'" @click="$refs.modal.close()" @closed="$emit('closed')">
	<div :class="$style.root">
		<div :class="$style.title">{{ i18n.ts.newUserAnnouncementAvailable }}</div>
		<MkButton :class="$style.gotIt" primary full @click="jumpTo">{{ i18n.ts.viewAnnouncement }}</MkButton>
	</div>
</MkModal>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n';
import { useRouter } from '@/router';
const router = useRouter();
const modal = shallowRef<InstanceType<typeof MkModal>>();

function jumpTo() {
	modal.value.close();
	router.push('/announcements');
}
</script>

<style lang="scss" module>
.root {
	margin: auto;
	position: relative;
	padding: 32px;
	min-width: 320px;
	max-width: 480px;
	box-sizing: border-box;
	text-align: center;
	background: var(--panel);
	border-radius: var(--radius);
}

.title {
	font-weight: bold;
}

.version {
	margin: 1em 0;
}

.gotIt {
	margin: 8px 0 0 0;
}
</style>