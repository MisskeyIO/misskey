<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from 'nativescript-vue';
import { SegmentedBarItem } from '@nativescript/core';
import type * as Misskey from 'misskey-js';
import { getApiClient, session } from '../state/session';
import { ensureStream } from '../services/streaming';
import { preferences, updatePreferences, type TimelineMode } from '../state/preferences';

const notes = ref<Misskey.entities.Note[]>([]);
const loading = ref(false);
const error = ref('');
let cleanupStream: (() => void) | null = null;

const timelineModes = [
  { mode: 'home', label: 'Home', endpoint: 'notes/timeline', channel: 'homeTimeline' },
  { mode: 'local', label: 'Local', endpoint: 'notes/local-timeline', channel: 'localTimeline' },
  { mode: 'hybrid', label: 'Hybrid', endpoint: 'notes/hybrid-timeline', channel: 'hybridTimeline' },
  { mode: 'global', label: 'Global', endpoint: 'notes/global-timeline', channel: 'globalTimeline' },
] as const;

const timelineItems = timelineModes.map((item) => {
  const barItem = new SegmentedBarItem();
  barItem.title = item.label;
  return barItem;
});

const selectedModeIndex = ref(Math.max(0, timelineModes.findIndex((item) => item.mode === preferences.timelineMode)));

function buildTimelineRequest(mode: TimelineMode) {
  const base = {
    limit: 20,
    withRenotes: preferences.timelineWithRenotes,
    withFiles: preferences.timelineWithFiles,
  };

  if (mode === 'local' || mode === 'hybrid') {
    return {
      ...base,
      withReplies: preferences.timelineWithReplies,
    };
  }

  return base;
}

async function loadTimeline() {
  error.value = '';
  loading.value = true;
  try {
    const client = getApiClient();
    const selectedMode = timelineModes[selectedModeIndex.value] ?? timelineModes[0];
    const response = await client.request(selectedMode.endpoint as any, buildTimelineRequest(selectedMode.mode) as any);
    notes.value = response as Misskey.entities.Note[];
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load timeline.';
  } finally {
    loading.value = false;
  }
}

function attachStream(mode: TimelineMode) {
  cleanupStream?.();
  cleanupStream = null;

  if (!session.instanceUrl || !session.account?.token) return;

  const selectedMode = timelineModes.find((item) => item.mode === mode);
  if (!selectedMode) return;

  const stream = ensureStream(session.instanceUrl, session.account.token);
  const params =
    mode === 'local' || mode === 'hybrid'
      ? {
          withRenotes: preferences.timelineWithRenotes,
          withReplies: preferences.timelineWithReplies,
          withFiles: preferences.timelineWithFiles,
        }
      : {
          withRenotes: preferences.timelineWithRenotes,
          withFiles: preferences.timelineWithFiles,
        };

  const connection = stream.useChannel(selectedMode.channel as any, params as any);
  connection.on('note' as any, (note: Misskey.entities.Note) => {
    notes.value = [note, ...notes.value].slice(0, 50);
  });
  cleanupStream = () => connection.dispose();
}

onMounted(() => {
  loadTimeline();
  attachStream(preferences.timelineMode);
});

onUnmounted(() => {
  cleanupStream?.();
  cleanupStream = null;
});

watch(selectedModeIndex, (index) => {
  const selectedMode = timelineModes[index]?.mode ?? 'home';
  updatePreferences({ timelineMode: selectedMode });
  notes.value = [];
  loadTimeline();
  attachStream(selectedMode);
});

watch(
  () => [preferences.timelineWithRenotes, preferences.timelineWithReplies, preferences.timelineWithFiles],
  () => {
    notes.value = [];
    loadTimeline();
    attachStream(preferences.timelineMode);
  },
);
</script>

<template>
  <StackLayout class="section">
    <SegmentedBar v-model="selectedModeIndex" :items="timelineItems" class="form-field" />
    <Button text="Refresh" class="secondary" @tap="loadTimeline" />
    <Label v-if="loading" text="Loading timeline..." class="muted" />
    <Label v-if="error" :text="error" class="error" />
    <Label v-if="!loading && !error && !notes.length" text="No notes yet." class="muted" />
    <ListView v-if="notes.length" :items="notes">
      <v-template>
        <StackLayout class="form-field">
          <Label :text="item.user?.name || item.user?.username" class="muted" />
          <Label :text="item.text ?? ''" textWrap="true" />
        </StackLayout>
      </v-template>
    </ListView>
  </StackLayout>
</template>
