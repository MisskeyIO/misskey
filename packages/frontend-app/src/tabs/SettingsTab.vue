<script lang="ts" setup>
import { ref, watch } from 'nativescript-vue';
import type * as Misskey from 'misskey-js';
import { SegmentedBarItem } from '@nativescript/core';
import { session, clearInstanceUrl } from '../state/session';
import { preferences, updatePreferences, type TimelineMode, type ComposeVisibility } from '../state/preferences';
import { getApiClient } from '../state/session';
import { createPasskeyCredential, isPasskeySupported } from '../services/passkey';

const timelineModes = [
  { label: 'Home', value: 'home' },
  { label: 'Local', value: 'local' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'Global', value: 'global' },
] as const;

const timelineItems = timelineModes.map((option) => {
  const item = new SegmentedBarItem();
  item.title = option.label;
  return item;
});

const timelineIndex = ref(Math.max(0, timelineModes.findIndex((option) => option.value === preferences.timelineMode)));

const composeOptions = [
  { label: 'Public', value: 'public' },
  { label: 'Home', value: 'home' },
  { label: 'Followers', value: 'followers' },
] as const;

const composeItems = composeOptions.map((option) => {
  const item = new SegmentedBarItem();
  item.title = option.label;
  return item;
});

const composeIndex = ref(Math.max(0, composeOptions.findIndex((option) => option.value === preferences.composeVisibility)));

const passkeyName = ref('');
const passkeyPassword = ref('');
const passkeyToken = ref('');
const passkeyBusy = ref(false);
const passkeyStatus = ref('');

function updateTimelineMode() {
  const selected = timelineModes[timelineIndex.value]?.value ?? 'home';
  updatePreferences({ timelineMode: selected as TimelineMode });
}

function updateComposeVisibility() {
  const selected = composeOptions[composeIndex.value]?.value ?? 'public';
  updatePreferences({ composeVisibility: selected as ComposeVisibility });
}

watch(
  () => preferences.timelineWithRenotes,
  (value) => updatePreferences({ timelineWithRenotes: value }),
);
watch(
  () => preferences.timelineWithReplies,
  (value) => updatePreferences({ timelineWithReplies: value }),
);
watch(
  () => preferences.timelineWithFiles,
  (value) => updatePreferences({ timelineWithFiles: value }),
);
watch(
  () => preferences.composeLocalOnly,
  (value) => updatePreferences({ composeLocalOnly: value }),
);
watch(
  () => preferences.composeUseCw,
  (value) => updatePreferences({ composeUseCw: value }),
);

async function registerPasskey() {
  passkeyStatus.value = '';
  if (!passkeyName.value.trim()) {
    passkeyStatus.value = 'Enter a name for the passkey.';
    return;
  }
  if (!passkeyPassword.value.trim()) {
    passkeyStatus.value = 'Password is required.';
    return;
  }
  if (!isPasskeySupported()) {
    passkeyStatus.value = 'Passkeys are not supported on this device.';
    return;
  }

  try {
    passkeyBusy.value = true;
    const client = getApiClient();
    const options = await client.request('i/2fa/register-key', {
      password: passkeyPassword.value,
      token: passkeyToken.value || undefined,
    } as Misskey.Endpoints['i/2fa/register-key']['req']);

    const credential = await createPasskeyCredential(options as any);

    await client.request('i/2fa/key-done', {
      password: passkeyPassword.value,
      token: passkeyToken.value || undefined,
      name: passkeyName.value.trim(),
      credential,
    } as Misskey.Endpoints['i/2fa/key-done']['req']);

    passkeyStatus.value = 'Passkey registered.';
    passkeyName.value = '';
    passkeyPassword.value = '';
    passkeyToken.value = '';
  } catch (err) {
    passkeyStatus.value = err instanceof Error ? err.message : 'Failed to register passkey.';
  } finally {
    passkeyBusy.value = false;
  }
}
</script>

<template>
  <ScrollView>
    <StackLayout class="section">
      <Label text="Instance" class="muted" />
      <Label :text="session.instanceUrl ?? ''" class="form-field" />
      <Button text="Change instance" class="secondary" @tap="clearInstanceUrl" />

      <Label text="Timeline" class="muted" />
      <SegmentedBar v-model="timelineIndex" :items="timelineItems" class="form-field" @selectedIndexChange="updateTimelineMode" />
      <GridLayout columns="*, auto" class="form-field">
        <Label text="Show renotes" class="muted" verticalAlignment="center" />
        <Switch v-model="preferences.timelineWithRenotes" col="1" />
      </GridLayout>
      <GridLayout columns="*, auto" class="form-field">
        <Label text="Show replies" class="muted" verticalAlignment="center" />
        <Switch v-model="preferences.timelineWithReplies" col="1" />
      </GridLayout>
      <GridLayout columns="*, auto" class="form-field">
        <Label text="Only notes with files" class="muted" verticalAlignment="center" />
        <Switch v-model="preferences.timelineWithFiles" col="1" />
      </GridLayout>

      <Label text="Compose defaults" class="muted" />
      <SegmentedBar v-model="composeIndex" :items="composeItems" class="form-field" @selectedIndexChange="updateComposeVisibility" />
      <GridLayout columns="*, auto" class="form-field">
        <Label text="Local-only by default" class="muted" verticalAlignment="center" />
        <Switch v-model="preferences.composeLocalOnly" col="1" />
      </GridLayout>
      <GridLayout columns="*, auto" class="form-field">
        <Label text="Enable CW by default" class="muted" verticalAlignment="center" />
        <Switch v-model="preferences.composeUseCw" col="1" />
      </GridLayout>

      <Label text="Passkey registration" class="muted" />
      <Label v-if="!isPasskeySupported()" text="Passkeys require device support and associated domain configuration." class="muted" />
      <TextField v-model="passkeyName" hint="Passkey name" class="form-field" />
      <TextField v-model="passkeyPassword" hint="Password" secure="true" class="form-field" />
      <TextField v-model="passkeyToken" hint="TOTP code (if required)" keyboardType="number" class="form-field" />
      <Button :isEnabled="!passkeyBusy" text="Register passkey" @tap="registerPasskey" />
      <Label v-if="passkeyStatus" :text="passkeyStatus" class="muted" />
    </StackLayout>
  </ScrollView>
</template>
