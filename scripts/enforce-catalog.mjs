/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_PREFIX = 'workspace:';
const CATALOG_VERSION = 'catalog:';

function parseJsonIfExists(p) {
	if (!fs.existsSync(p)) return null;
	try {
		return JSON.parse(fs.readFileSync(p, 'utf8'));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Failed to parse JSON in ${p}:`, message);
		return null;
	}
}

function readWorkspacePackagePaths(workspacePath) {
	const lines = fs.readFileSync(workspacePath, 'utf8').split('\n');
	const packages = [];
	let inPackages = false;

	for (const line of lines) {
		if (line === 'packages:') {
			inPackages = true;
			continue;
		}
		if (inPackages && line.length > 0 && !line.startsWith(' ')) break;
		const match = inPackages ? line.match(/^  - (.+)$/) : null;
		if (match) packages.push(match[1]);
	}

	return packages;
}

function updateDepsSection(pkgJson, section) {
	const deps = pkgJson[section];
	if (!deps || typeof deps !== 'object') return false;

	let changed = false;
	for (const name of Object.keys(deps)) {
		if (!deps[name].startsWith(WORKSPACE_PREFIX) && deps[name] !== CATALOG_VERSION) {
			deps[name] = CATALOG_VERSION;
			changed = true;
		}
	}
	return changed;
}

function processPackageJson(pkgJsonPath) {
	const pkgJson = parseJsonIfExists(pkgJsonPath);
	if (!pkgJson) {
		console.warn(`Skipping missing ${pkgJsonPath}`);
		return;
	}

	let changed = false;
	if (updateDepsSection(pkgJson, 'dependencies')) changed = true;
	if (updateDepsSection(pkgJson, 'devDependencies')) changed = true;
	if (updateDepsSection(pkgJson, 'optionalDependencies')) changed = true;

	if (!changed) {
		console.log(`No changes in ${pkgJsonPath}`);
		return;
	}

	fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, '\t')}\n`, 'utf8');
	console.log(`Updated ${pkgJsonPath}`);
}

const rootDir = path.resolve(__dirname, '..');
const workspacePath = path.join(rootDir, 'pnpm-workspace.yaml');
const rootPkgJsonPath = path.join(rootDir, 'package.json');

[
	rootPkgJsonPath,
	...readWorkspacePackagePaths(workspacePath).map((pkgPath) => path.join(rootDir, pkgPath, 'package.json')),
].forEach((p) => processPackageJson(p));
