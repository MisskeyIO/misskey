<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
        <div />
</template>

<script setup lang="ts">
import { onBeforeMount } from 'vue';
import { useRouter } from '@/router.js';

const router = useRouter();

onBeforeMount(() => {
        router.replace('/settings/emoji-palette');
});
</script>
