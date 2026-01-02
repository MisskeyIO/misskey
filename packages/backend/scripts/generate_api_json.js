/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { execa } from 'execa';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

async function main() {
	if (!process.argv.includes('--no-build')) {
		await execa('pnpm', ['run', 'build'], {
			stdout: process.stdout,
			stderr: process.stderr,
		});
	}

	if (!existsSync(resolve(_dirname, '..', 'built'))) {
		throw new Error('`built` directory does not exist.');
	}

	if (!process.env.MISSKEY_CONFIG_YML) {
		const configDir = resolve(_dirname, '..', '..', '..', '.config');
		const defaultConfig = resolve(configDir, 'default.yml');
		const exampleConfig = resolve(configDir, 'example.yml');
		if (!existsSync(defaultConfig) && existsSync(exampleConfig)) {
			process.env.MISSKEY_CONFIG_YML = 'example.yml';
		}
	}

	/** @type {import('../src/config.js')} */
	const { loadConfig } = await import('../built/config.js');

	/** @type {import('../src/server/api/openapi/gen-spec.js')} */
	const { genOpenapiSpec } = await import('../built/server/api/openapi/gen-spec.js');

	const config = loadConfig();
	const spec = genOpenapiSpec(config, true);

	writeFileSync(resolve(_dirname, '..', 'built', 'api.json'), JSON.stringify(spec), 'utf-8');
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
