<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkResult type="empty" :text="i18n.ts._chat.noRooms"/>
</template>

<script lang="ts" setup>
import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n.js';

defineProps<{
	room: Misskey.entities.ChatRoom;
}>();
</script>
