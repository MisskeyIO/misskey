/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { execa } from 'execa';
import { writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
	if (!process.argv.includes('--no-build')) {
		await execa('pnpm', ['run', 'build'], {
			stdout: process.stdout,
			stderr: process.stderr,
		});
	}

	if (!existsSync('./built')) {
		throw new Error('`built` directory does not exist.');
	}

	const rootMetaPath = resolve(__dirname, '../../../built/meta.json');
	if (!existsSync(rootMetaPath)) {
		const rootMetaDir = dirname(rootMetaPath);
		if (!existsSync(rootMetaDir)) {
			mkdirSync(rootMetaDir, { recursive: true });
		}

		const fallbackMetaPath = resolve(__dirname, '../../meta.json');
		if (existsSync(fallbackMetaPath)) {
			copyFileSync(fallbackMetaPath, rootMetaPath);
		} else {
			writeFileSync(rootMetaPath, JSON.stringify({ version: 'unknown' }), 'utf-8');
		}
	}

	const defaultConfigPath = resolve(__dirname, '../../../.config/default.yml');
	if (!existsSync(defaultConfigPath)) {
		const exampleConfigPath = resolve(__dirname, '../../../.config/example.yml');
		if (existsSync(exampleConfigPath)) {
			copyFileSync(exampleConfigPath, defaultConfigPath);
		} else {
			writeFileSync(defaultConfigPath, '', 'utf-8');
		}
	}

	/** @type {import('../src/config.js')} */
	const { loadConfig } = await import('../built/config.js');

	/** @type {import('../src/server/api/openapi/gen-spec.js')} */
	const { genOpenapiSpec } = await import('../built/server/api/openapi/gen-spec.js');

	const config = loadConfig();
	const spec = genOpenapiSpec(config, true);

	writeFileSync('./built/api.json', JSON.stringify(spec), 'utf-8');
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
