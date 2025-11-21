import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATALOG_VERSION = 'catalog:';

function readFileIfExists(p) {
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

function updateDepsSection(pkgJson, section) {
  const deps = pkgJson[section];
  if (!deps || typeof deps !== 'object') return false;

  let changed = false;
  for (const name of Object.keys(deps)) {
    if (!deps[name].startsWith('workspace:') && deps[name] !== CATALOG_VERSION) {
      deps[name] = CATALOG_VERSION;
      changed = true;
    }
  }
  return changed;
}

function processPackageJson(pkgJsonPath) {
  const content = readFileIfExists(pkgJsonPath);
  if (!content) {
    console.warn(`Skipping missing ${pkgJsonPath}`);
    return;
  }

  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    console.error(`Failed to parse JSON in ${pkgJsonPath}:`, e.message);
    return;
  }

  let changed = false;
  if (updateDepsSection(json, 'dependencies')) changed = true;
  if (updateDepsSection(json, 'devDependencies')) changed = true;
  if (updateDepsSection(json, 'optionalDependencies')) changed = true;

  if (!changed) {
    console.log(`No changes in ${pkgJsonPath}`);
    return;
  }

  fs.writeFileSync(pkgJsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`Updated ${pkgJsonPath}`);
}

const rootDir = path.resolve(__dirname, '..');
const rootPkgJsonPath = path.join(rootDir, 'package.json');
const rootPkgJson = readFileIfExists(rootPkgJsonPath);
if (!rootPkgJson) {
	console.error('Root package.json not found.');
	process.exit(1);
}

const workspaces = JSON.parse(rootPkgJson).workspaces || [];
[
	rootPkgJsonPath,
	...workspaces.map((pkgPath) => path.join(rootDir, pkgPath, 'package.json')),
].forEach((p) => processPackageJson(p));
