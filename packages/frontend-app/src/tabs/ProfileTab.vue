<script lang="ts" setup>
import { computed } from 'nativescript-vue';
import { session, signOut } from '../state/session';

const username = computed(() => session.account?.username ?? '');
const name = computed(() => session.account?.name ?? '');
const instanceUrl = computed(() => session.instanceUrl ?? '');

function onSignOut() {
  signOut();
}
</script>

<template>
  <StackLayout class="section">
    <Label :text="name" class="form-field" />
    <Label :text="`@${username}`" class="muted" />
    <Label :text="instanceUrl" class="muted" />
    <Button class="secondary" text="Sign Out" @tap="onSignOut" />
  </StackLayout>
</template>
