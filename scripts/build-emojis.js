/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const fsp = require('node:fs/promises');
const { createRequire } = require('node:module');
const { dirname, resolve } = require('node:path');

const rootDir = resolve(__dirname, '..');
const ifPresent = process.argv.includes('--if-present');
const emojiAssetsDir = resolve(rootDir, 'packages/emojis/packages/emoji-assets');
const emojiAssetsBuiltDir = resolve(emojiAssetsDir, 'built');
const fluentEmojiSourceDir = resolve(rootDir, 'packages/emojis/fluent-emoji/assets');
const twemojiSourceDir = resolve(rootDir, 'packages/emojis/twemoji/assets/svg');
const requireFromEmojiAssets = createRequire(resolve(emojiAssetsDir, 'package.json'));

const UNICODE_SKIN_TONES = {
	'1f3ff': 'Dark',
	'1f3fe': 'Medium-Dark',
	'1f3fd': 'Medium',
	'1f3fc': 'Medium-Light',
	'1f3fb': 'Light',
};

const UNICODE_SKIN_TONE_REGEX = /(1f3ff|1f3fe|1f3fd|1f3fc|1f3fb)/;
const VS16 = 'fe0f';
const ZERO_WIDTH_JOINER = '200d';

async function processFluentEmojiImage(src, dest) {
	const sharp = requireFromEmojiAssets('sharp');

	await sharp(src)
		.resize({ width: 64, height: 64, fit: 'inside' })
		.toFile(dest);
}

function removeVS16s(unicodes) {
	if (unicodes.includes(ZERO_WIDTH_JOINER)) {
		return unicodes;
	}

	return unicodes.filter((unicode) => unicode !== VS16);
}

function normalizeFluentEmojiFilename(unicode) {
	return removeVS16s(unicode.toLowerCase().split(' ')).map((codepoint) => codepoint.replace(/^0+/, '')).join('-');
}

async function buildEmojiAssets() {
	if (!existsSync(fluentEmojiSourceDir) || !existsSync(twemojiSourceDir)) {
		if (ifPresent) {
			console.log('Skipping emoji build because emoji submodules are not initialized.');
			return false;
		}

		throw new Error('Emoji submodules are not initialized. Run `git submodule update --init --recursive packages/emojis`.');
	}

	if (existsSync(emojiAssetsBuiltDir)) {
		console.log(`Removing existing assets build directory at ${emojiAssetsBuiltDir}`);
		await fsp.rm(emojiAssetsBuiltDir, { recursive: true, force: true });
	}

	await fsp.mkdir(emojiAssetsBuiltDir, { recursive: true });
	console.log(`Created assets build directory at ${emojiAssetsBuiltDir}`);

	const licensesToCopy = await Array.fromAsync(fsp.glob(resolve(rootDir, 'packages/emojis/LICENSE*')));
	await Promise.all(licensesToCopy.map(async (src) => {
		const filename = src.split(/[\\/]/).pop();
		await fsp.copyFile(src, resolve(emojiAssetsDir, filename));
	}));
	console.log(`Copied licenses to ${emojiAssetsDir}`);

	const twemojiDest = resolve(emojiAssetsBuiltDir, 'twemoji');
	await fsp.mkdir(twemojiDest, { recursive: true });
	await fsp.cp(twemojiSourceDir, twemojiDest, { recursive: true });
	console.log(`Copied Twemoji SVGs from ${twemojiSourceDir} to ${twemojiDest}`);

	const definitions = fsp.glob(resolve(fluentEmojiSourceDir, '*/metadata.json'));
	const fluentEmojiDest = resolve(emojiAssetsBuiltDir, 'fluent-emoji');
	await fsp.mkdir(fluentEmojiDest, { recursive: true });

	for await (const definition of definitions) {
		const defJson = JSON.parse(await fsp.readFile(definition, 'utf-8'));

		if (defJson.unicodeSkintones != null) {
			const emojiWritePromises = defJson.unicodeSkintones
				.filter((unicode) => Object.keys(UNICODE_SKIN_TONES).some((tone) => unicode.includes(tone)))
				.map(async (unicode) => {
					const tone = UNICODE_SKIN_TONE_REGEX.exec(unicode);

					if (tone == null || UNICODE_SKIN_TONES[tone[0]] == null) {
						console.error(`No skin tone found in unicode: ${unicode}`);
						return;
					}

					const dir = resolve(dirname(definition), `${UNICODE_SKIN_TONES[tone[0]]}/3D`);
					const src = await Array.fromAsync(fsp.glob(resolve(dir, '*.png')));

					if (src.length === 0) {
						console.error(`No image found for ${unicode} in ${dir}`);
						return;
					}

					const dest = resolve(fluentEmojiDest, `${normalizeFluentEmojiFilename(unicode)}.png`);
					await processFluentEmojiImage(src[0], dest);
				});

			emojiWritePromises.push((async () => {
				const unicode = normalizeFluentEmojiFilename(defJson.unicode);
				const dir = resolve(dirname(definition), 'Default/3D');
				const src = await Array.fromAsync(fsp.glob(resolve(dir, '*.png')));

				if (src.length === 0) {
					console.error(`No image found for ${unicode} in ${dir}`);
					return;
				}

				const dest = resolve(fluentEmojiDest, `${unicode}.png`);
				await processFluentEmojiImage(src[0], dest);
			})());

			await Promise.all(emojiWritePromises);
		} else {
			const unicode = normalizeFluentEmojiFilename(defJson.unicode);
			const dir = resolve(dirname(definition), '3D');
			const src = await Array.fromAsync(fsp.glob(resolve(dir, '*.png')));

			if (src.length === 0) {
				console.error(`No image found for ${unicode} in ${dir}`);
				continue;
			}

			const dest = resolve(fluentEmojiDest, `${unicode}.png`);
			await processFluentEmojiImage(src[0], dest);
		}
	}

	console.log(`Copied Fluent Emoji images to ${fluentEmojiDest}`);
	return true;
}

function runCommand(command, args, cwd) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: 'inherit',
			shell: process.platform === 'win32',
		});

		child.on('error', reject);
		child.on('exit', (code, signal) => {
			if (code === 0) {
				resolvePromise();
				return;
			}

			reject(new Error(`${command} ${args.join(' ')} failed with ${signal ?? `exit code ${code}`}`));
		});
	});
}

async function buildEmojiData() {
	await runCommand('pnpm', ['exec', 'tsgo', '-p', 'packages/emojis/packages/emoji-data/tsconfig.json', '--noEmit', '--skipLibCheck'], rootDir);
	await runCommand('pnpm', ['--filter', '@misskey-dev/emoji-data', 'build'], rootDir);
}

buildEmojiAssets()
	.then(async (builtAssets) => {
		if (builtAssets) {
			await buildEmojiData();
		}
	})
	.catch((error) => {
		console.error('Build failed:', error);
		process.exit(1);
	});
