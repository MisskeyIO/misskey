import path from 'path';
import pluginReplace from '@rollup/plugin-replace';
import pluginVue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import type { UserConfig } from 'vite';
import * as yaml from 'js-yaml';
import { promises as fsp } from 'fs';

import locales from '../../locales/index.js';
import meta from '../../package.json';
import packageInfo from './package.json' with { type: 'json' };
import pluginJson5 from './vite.json5.js';
import pluginCreateSearchIndex from './lib/vite-plugin-create-search-index.js';
import type { Options as SearchIndexOptions } from './lib/vite-plugin-create-search-index.js';
import { Features } from 'lightningcss';

const url = process.env.NODE_ENV === 'development' ? yaml.load(await fsp.readFile('../../.config/default.yml', 'utf-8')).url : null;
const host = url ? (new URL(url)).hostname : undefined;

const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.json5', '.svg', '.sass', '.scss', '.css', '.vue'];

/**
 * 検索インデックスの生成設定
 */
export const searchIndexes = [{
	targetFilePaths: ['src/pages/settings/*.vue'],
	mainVirtualModule: 'search-index:settings',
	modulesToHmrOnUpdate: ['src/pages/settings/index.vue'],
	verbose: process.env.FRONTEND_SEARCH_INDEX_VERBOSE === 'true',
}] satisfies SearchIndexOptions[];

/**
 * Misskeyのフロントエンドにバンドルせず、CDNなどから別途読み込むリソースを記述する。
 * CDNを使わずにバンドルしたい場合、以下の配列から該当要素を削除orコメントアウトすればOK
 */
const externalPackages = [
	// shiki（コードブロックのシンタックスハイライトで使用中）はテーマ・言語の定義の容量が大きいため、それらはCDNから読み込む
	{
		name: 'shiki',
		match: /^shiki\/(?<subPkg>(langs|themes))$/,
		path(id: string, pattern: RegExp): string {
			const match = pattern.exec(id)?.groups;
			return match
				? `https://esm.sh/shiki@${packageInfo.dependencies.shiki}/${match['subPkg']}`
				: id;
		},
	},
];

export const hash = (str: string, seed = 0): number => {
	let h1 = 0xdeadbeef ^ seed,
		h2 = 0x41c6ce57 ^ seed;
	for (let i = 0, ch; i < str.length; i++) {
		ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}

	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

	return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

export const BASE62_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function toBase62(n: number): string {
	if (n === 0) {
		return '0';
	}
	let result = '';
	while (n > 0) {
		result = BASE62_DIGITS[n % BASE62_DIGITS.length] + result;
		n = Math.floor(n / BASE62_DIGITS.length);
	}

	return result;
}

export function getConfig(): UserConfig {
	return {
		base: '/vite/',

		server: {
			host,
			port: 5173,
			headers: { // なんか効かない
				'X-Frame-Options': 'DENY',
			},
		},

		plugins: [
			...searchIndexes.map(options => pluginCreateSearchIndex(options)),
			pluginVue(),
			pluginJson5(),
			...process.env.NODE_ENV === 'production'
				? [
					pluginReplace({
						preventAssignment: true,
						values: {
							'isChromatic()': JSON.stringify(false),
						},
					}),
				]
				: [],
		],

		resolve: {
			extensions,
			alias: {
				'@/': __dirname + '/src/',
				'@@/': __dirname + '/../frontend-shared/',
				'/client-assets/': __dirname + '/assets/',
				'/static-assets/': __dirname + '/../backend/assets/',
				'/fluent-emojis/': __dirname + '/../../fluent-emojis/dist/',
				'/fluent-emoji/': __dirname + '/../../fluent-emojis/dist/',
			},
		},

		css: {
			lightningcss: {
				exclude: Features.LightDark,
			},
			modules: {
				generateScopedName(name, filename, _css): string {
					const id = (path.relative(__dirname, filename.split('?')[0]) + '-' + name).replace(/[\\\/\.\?&=]/g, '-').replace(/(src-|vue-)/g, '');
					if (process.env.NODE_ENV === 'production') {
						return 'x' + toBase62(hash(id)).substring(0, 4);
					} else {
						return id;
					}
				},
			},
			preprocessorOptions: {
				scss: {
					api: 'modern-compiler',
				},
			},
		},

		define: {
			_VERSION_: JSON.stringify(meta.version),
			_LANGS_: JSON.stringify(Object.entries(locales).map(([k, v]) => [k, v._lang_])),
			_ENV_: JSON.stringify(process.env.NODE_ENV),
			_DEV_: process.env.NODE_ENV !== 'production',
			_PERF_PREFIX_: JSON.stringify('Misskey:'),
			_DATA_TRANSFER_DRIVE_FILE_: JSON.stringify('mk_drive_file'),
			_DATA_TRANSFER_DRIVE_FOLDER_: JSON.stringify('mk_drive_folder'),
			_DATA_TRANSFER_DECK_COLUMN_: JSON.stringify('mk_deck_column'),
			__VUE_OPTIONS_API__: true,
			__VUE_PROD_DEVTOOLS__: false,
		},

		build: {
			target: [
				'chrome130',
				'firefox132',
				'safari18.2',
			],
			manifest: 'manifest.json',
			rollupOptions: {
				input: {
					app: './src/_boot_.ts',
				},
				external: externalPackages.map(p => p.match),
				output: {
					manualChunks: {
						vue: ['vue'],
						photoswipe: ['photoswipe', 'photoswipe/lightbox', 'photoswipe/style.css'],
					},
					entryFileNames: `${meta.version}.[hash].js`,
					chunkFileNames: `${meta.version}.[hash].js`,
					assetFileNames: `${meta.version}.[hash][extname]`,
					sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
						const repoRoot = path.resolve(__dirname, '../..');
						const absoluteSourcePath = path.isAbsolute(relativeSourcePath)
							? relativeSourcePath
							: path.resolve(path.dirname(sourcemapPath), relativeSourcePath);
						const rootedPath = path.relative(repoRoot, absoluteSourcePath);

						return rootedPath.startsWith('..')
							? relativeSourcePath.replaceAll('\\', '/')
							: rootedPath.replaceAll('\\', '/');
					},
					paths(id: string): string {
						for (const p of externalPackages) {
							if (p.match.test(id)) return p.path(id, p.match);
						}
						return id;
					},
				},
			},
			cssCodeSplit: true,
			cssMinify: 'lightningcss',
			outDir: __dirname + '/../../built/_frontend_vite_',
			assetsDir: '.',
			emptyOutDir: false,
			sourcemap: true,
			reportCompressedSize: false,
		},

		worker: {
			format: 'es',
		},

		test: {
			environment: 'jsdom',
			fileParallelism: false,
			deps: {
				optimizer: {
					web: {
						include: [
							// XXX: misskey-dev/browser-image-resizer has no "type": "module"
							'browser-image-resizer',
						],
					},
				},
			},
			includeSource: ['src/**/*.ts'],
		},
	};
}

const config = defineConfig(({ command, mode }) => getConfig());

export default config;
