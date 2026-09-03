/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs/promises';

async function copyFrontendFonts() {
	await fs.cp('./packages/frontend/node_modules/three/examples/fonts', './built/_frontend_dist_/fonts', { dereference: true, recursive: true });
}

await copyFrontendFonts();
