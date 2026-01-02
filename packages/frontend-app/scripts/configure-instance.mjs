import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const instanceUrlEnv = process.env.MISSKEY_INSTANCE_URL?.trim() ?? '';
const instanceDomainEnv = process.env.MISSKEY_INSTANCE_DOMAIN?.trim() ?? '';

let instanceUrl = '';
let instanceDomain = '';

function normalizeUrl(url) {
  const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported protocol for MISSKEY_INSTANCE_URL: ${parsed.protocol}`);
  }
  return `${parsed.protocol}//${parsed.host}`;
}

if (instanceUrlEnv) {
  instanceUrl = normalizeUrl(instanceUrlEnv);
  instanceDomain = new URL(instanceUrl).hostname;
} else if (instanceDomainEnv) {
  instanceDomain = instanceDomainEnv.replace(/^https?:\/\//i, '');
  instanceUrl = `https://${instanceDomain}`;
}

if (!instanceDomain) {
  console.error('MISSKEY_INSTANCE_URL or MISSKEY_INSTANCE_DOMAIN is required for per-instance builds.');
  process.exit(1);
}

const entitlementsPath = path.join(projectRoot, 'App_Resources', 'iOS', 'app.entitlements');
const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.developer.associated-domains</key>
    <array>
      <string>webcredentials:${instanceDomain}</string>
    </array>
  </dict>
</plist>
`;

writeFileSync(entitlementsPath, entitlements, 'utf8');

const configDir = path.join(projectRoot, 'src', 'config');
mkdirSync(configDir, { recursive: true });

const buildConfigPath = path.join(configDir, 'build.ts');
const buildConfig = `export const DEFAULT_INSTANCE_URL = ${JSON.stringify(instanceUrl)};
export const DEFAULT_INSTANCE_DOMAIN = ${JSON.stringify(instanceDomain)};
`;
writeFileSync(buildConfigPath, buildConfig, 'utf8');

console.log(`Configured instance for frontend-app: ${instanceUrl}`);
