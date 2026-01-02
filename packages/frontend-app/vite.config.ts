import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import { vueConfig } from '@nativescript/vite';

export default defineConfig(({ mode }): UserConfig => {
  return mergeConfig(vueConfig({ mode }), {});
});
