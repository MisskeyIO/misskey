/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { StorybookConfig } from '@storybook/vue3-vite';
import type { PluginOption, UserConfig } from 'vite';

const require = createRequire(import.meta.url);

const excludedVitePluginNames = new Set([
	'replace',
	'autoAssignMarkerId',
	'generateSearchIndexVirtualModule',
	'UnwindCssModuleClassName',
]);

export const config = {
	stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
	staticDirs: [{ from: '../assets', to: '/client-assets' }],
	addons: [
		getAbsolutePath('@storybook/addon-links'),
		getAbsolutePath('@storybook/addon-docs'),
	],
	framework: {
		name: getAbsolutePath('@storybook/vue3-vite') as '@storybook/vue3-vite',
		options: {},
	},
	core: {
		disableTelemetry: true,
	},
	async viteFinal(config: UserConfig) {
		if (config.plugins != null) {
			config.plugins = config.plugins.filter(plugin => !isExcludedVitePlugin(plugin));
		}

		return config;
	},
} satisfies StorybookConfig;

function getAbsolutePath(value: string): string {
	return dirname(require.resolve(join(value, 'package.json')));
}

function isExcludedVitePlugin(plugin: PluginOption): boolean {
	if (plugin == null || plugin === false || Array.isArray(plugin) || typeof plugin === 'function') {
		return false;
	}

	return 'name' in plugin && typeof plugin.name === 'string' && excludedVitePluginNames.has(plugin.name);
}
