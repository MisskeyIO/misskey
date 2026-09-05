import { defineConfig, mergeConfig } from 'vitest/config';
import { baseConfig } from './vitest.config.js';

export default mergeConfig(
	baseConfig,
	defineConfig({
		test: {
			include: ['./test/e2e/**/*.ts'],
			globalSetup: './built-test/entry.js',
			setupFiles: ['./test/setup.e2e.ts'],
			server: {
				deps: {
					// ビルド済みの起動コードを再変換して停止するのを防ぐ。
					external: [/\/built-test\/entry\.js$/],
				},
			},
		},
	}),
);
