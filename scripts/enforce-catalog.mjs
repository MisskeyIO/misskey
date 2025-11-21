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
	} catch (e) {
		console.error(`Failed to parse JSON in ${p}:`, e.message);
		return null;
	}
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

  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');
  console.log(`Updated ${pkgJsonPath}`);
}

const rootDir = path.resolve(__dirname, '..');
const rootPkgJsonPath = path.join(rootDir, 'package.json');
const rootPkgJson = parseJsonIfExists(rootPkgJsonPath);
if (!rootPkgJson) {
	console.error('Root package.json not found.');
	process.exit(1);
}

const workspaces = rootPkgJson.workspaces || [];
[
	rootPkgJsonPath,
	...workspaces.map((pkgPath) => path.join(rootDir, pkgPath, 'package.json')),
].forEach((p) => processPackageJson(p));
