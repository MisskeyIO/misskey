import { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'io.misskey.frontendapp',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  bundler: 'vite',
  bundlerConfigPath: 'vite.config.ts',
} as NativeScriptConfig;
