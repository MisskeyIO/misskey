<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'nativescript-vue';
import type * as Misskey from 'misskey-js';
import { getApiClient, session } from '../state/session';
import { ensureStream } from '../services/streaming';

const notifications = ref<Misskey.entities.Notification[]>([]);
const loading = ref(false);
const error = ref('');
let cleanupStream: (() => void) | null = null;

async function loadNotifications() {
  error.value = '';
  loading.value = true;
  try {
    const client = getApiClient();
    const response = await client.request('i/notifications', {
      limit: 20,
    } as Misskey.Endpoints['i/notifications']['req']);
    notifications.value = response as Misskey.entities.Notification[];
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load notifications.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadNotifications();
  if (session.instanceUrl && session.account?.token) {
    const stream = ensureStream(session.instanceUrl, session.account.token);
    const connection = stream.useChannel('main');
    connection.on('notification', (notification) => {
      notifications.value = [notification, ...notifications.value].slice(0, 50);
    });
    cleanupStream = () => connection.dispose();
  }
});

onUnmounted(() => {
  cleanupStream?.();
  cleanupStream = null;
});
</script>

<template>
  <StackLayout class="section">
    <Button text="Refresh" class="secondary" @tap="loadNotifications" />
    <Label v-if="loading" text="Loading notifications..." class="muted" />
    <Label v-if="error" :text="error" class="error" />
    <Label v-if="!loading && !error && !notifications.length" text="No notifications." class="muted" />
    <ListView v-if="notifications.length" :items="notifications">
      <v-template>
        <StackLayout class="form-field">
          <Label :text="item.type" class="muted" />
          <Label :text="item.createdAt" class="muted" />
        </StackLayout>
      </v-template>
    </ListView>
  </StackLayout>
</template>
