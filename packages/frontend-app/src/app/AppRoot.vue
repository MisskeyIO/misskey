<script lang="ts" setup>
import { computed } from 'nativescript-vue';
import { session, isSignedIn } from '../state/session';
import InstanceSelectPage from '../screens/InstanceSelectPage.vue';
import SignInPage from '../screens/SignInPage.vue';
import MainShellPage from '../screens/MainShellPage.vue';

const currentPage = computed(() => {
  if (!session.instanceUrl) return InstanceSelectPage;
  if (!isSignedIn.value) return SignInPage;
  return MainShellPage;
});
</script>

<template>
  <Frame>
    <component :is="currentPage" />
  </Frame>
</template>
