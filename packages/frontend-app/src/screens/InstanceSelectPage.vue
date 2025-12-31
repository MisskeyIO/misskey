<script lang="ts" setup>
import { ref } from 'nativescript-vue';
import { setInstanceUrl } from '../state/session';
import { DEFAULT_INSTANCE_URL } from '../config/build';

const instanceInput = ref(DEFAULT_INSTANCE_URL ?? '');
const error = ref('');
const busy = ref(false);

async function onContinue() {
  error.value = '';
  if (!instanceInput.value.trim()) {
    error.value = 'Instance URL is required.';
    return;
  }

  try {
    busy.value = true;
    setInstanceUrl(instanceInput.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Invalid instance URL.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Page>
    <ActionBar title="Choose Instance" />
    <StackLayout class="section">
      <Label text="Enter your Misskey instance URL" class="muted" />
      <TextField
        v-model="instanceInput"
        hint="misskey.example.com"
        keyboardType="url"
        autocorrect="false"
        autocapitalizationType="none"
        class="form-field"
      />
      <Button :isEnabled="!busy" text="Continue" @tap="onContinue" />
      <Label v-if="error" :text="error" class="error" />
    </StackLayout>
  </Page>
</template>
