<script lang="ts" setup>
import { ref, watch } from 'nativescript-vue';
import { SegmentedBarItem } from '@nativescript/core';
import type * as Misskey from 'misskey-js';
import { getApiClient } from '../state/session';
import { preferences, updatePreferences, type ComposeVisibility } from '../state/preferences';

const text = ref('');
const busy = ref(false);
const error = ref('');
const success = ref('');

const useCw = ref(preferences.composeUseCw);
const cw = ref('');

const visibilityOptions = [
  { label: 'Public', value: 'public' },
  { label: 'Home', value: 'home' },
  { label: 'Followers', value: 'followers' },
] as const;

const visibilityItems = visibilityOptions.map((option) => {
  const barItem = new SegmentedBarItem();
  barItem.title = option.label;
  return barItem;
});

const selectedVisibilityIndex = ref(
  Math.max(0, visibilityOptions.findIndex((option) => option.value === preferences.composeVisibility)),
);

const localOnly = ref(preferences.composeLocalOnly);

watch(selectedVisibilityIndex, (index) => {
  const visibility = visibilityOptions[index]?.value ?? 'public';
  updatePreferences({ composeVisibility: visibility });
});

watch(localOnly, (value) => {
  updatePreferences({ composeLocalOnly: value });
});

watch(useCw, (value) => {
  updatePreferences({ composeUseCw: value });
});

function currentVisibility(): ComposeVisibility {
  return visibilityOptions[selectedVisibilityIndex.value]?.value ?? 'public';
}

async function onPost() {
  error.value = '';
  success.value = '';

  if (!text.value.trim()) {
    error.value = 'Note text is required.';
    return;
  }

  try {
    busy.value = true;
    const client = getApiClient();
    const request: Misskey.Endpoints['notes/create']['req'] = {
      text: text.value,
      visibility: currentVisibility(),
      localOnly: localOnly.value,
      cw: useCw.value ? cw.value : undefined,
    } as Misskey.Endpoints['notes/create']['req'];

    await client.request('notes/create', request);
    success.value = 'Posted.';
    text.value = '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to post.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <StackLayout class="section">
    <Label text="Visibility" class="muted" />
    <SegmentedBar v-model="selectedVisibilityIndex" :items="visibilityItems" class="form-field" />

    <GridLayout columns="*, auto" class="form-field">
      <Label text="Local-only" class="muted" verticalAlignment="center" />
      <Switch v-model="localOnly" col="1" />
    </GridLayout>

    <GridLayout columns="*, auto" class="form-field">
      <Label text="Content warning" class="muted" verticalAlignment="center" />
      <Switch v-model="useCw" col="1" />
    </GridLayout>

    <TextField v-if="useCw" v-model="cw" hint="CW" class="form-field" />

    <TextView
      v-model="text"
      hint="What's happening?"
      textWrap="true"
      class="form-field"
    />
    <Button :isEnabled="!busy" text="Post" @tap="onPost" />
    <Label v-if="success" :text="success" class="muted" />
    <Label v-if="error" :text="error" class="error" />
  </StackLayout>
</template>
