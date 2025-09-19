/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootPackageJsonPath = path.resolve(__dirname, '../package.json');
const misskeyJsPackageJsonPath = path.resolve(__dirname, '../packages/misskey-js/package.json');
const gitDirectoryPath = path.resolve(__dirname, '../.git');
const gitShortHashFilePath = path.resolve(__dirname, '../.git-commit');
const isProductionBuild = process.env.NODE_ENV === 'production';

function readJson(filePath) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, '\t') + '\n', 'utf-8');
}

function removeGitHashSuffix(version) {
        return version.replace(/[-+][0-9a-f]{7,}$/i, '');
}

function readGitShortHashFromFile() {
        try {
                const content = fs.readFileSync(gitShortHashFilePath, 'utf-8').trim();

                if (content.length === 0) {
                        return null;
                }

                if (!/^[0-9a-f]{7,}$/i.test(content)) {
                        console.warn(`Invalid git commit hash found in ${path.basename(gitShortHashFilePath)}: ${content}`);
                        return null;
                }

                return content;
        } catch (error) {
                if (error.code !== 'ENOENT') {
                        console.warn('Unable to read git commit hash from file:', error);
                }

                return null;
        }
}

function getGitShortHash() {
        const hasGitDirectory = fs.existsSync(gitDirectoryPath);

        if (hasGitDirectory) {
                try {
                        return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', cwd: __dirname }).trim();
                } catch (error) {
                        console.warn('Unable to determine git commit hash using git:', error);
                }
        }

        const fallbackHash = readGitShortHashFromFile();

        if (fallbackHash) {
                return fallbackHash;
        }

        if (!hasGitDirectory) {
                console.warn(`Unable to determine git commit hash: ${path.basename(gitShortHashFilePath)} is missing or invalid.`);
        }

        return null;
}

function ensureVersions() {
        const rootPackageJson = readJson(rootPackageJsonPath);
        let effectiveVersion = rootPackageJson.version;

        if (isProductionBuild) {
                const shortHash = getGitShortHash();

                if (shortHash) {
                        const baseVersion = removeGitHashSuffix(rootPackageJson.version);
                        const versionWithHash = `${baseVersion}-${shortHash}`;

                        if (rootPackageJson.version !== versionWithHash) {
                                rootPackageJson.version = versionWithHash;
                                writeJson(rootPackageJsonPath, rootPackageJson);
                                console.log(`Updated root package version to ${versionWithHash}`);
                        }

                        effectiveVersion = versionWithHash;

                        try {
                                const misskeyJsPackageJson = readJson(misskeyJsPackageJsonPath);

                                if (misskeyJsPackageJson.version !== versionWithHash) {
                                        misskeyJsPackageJson.version = versionWithHash;
                                        writeJson(misskeyJsPackageJsonPath, misskeyJsPackageJson);
                                        console.log(`Updated misskey-js package version to ${versionWithHash}`);
                                }
                        } catch (error) {
                                console.warn('Unable to update misskey-js package version:', error);
                        }
                }
        }

        return effectiveVersion;
}

function build() {
        try {
                const version = ensureVersions();
                fs.mkdirSync(path.resolve(__dirname, '../built'), { recursive: true });
                fs.writeFileSync(path.resolve(__dirname, '../built/meta.json'), JSON.stringify({ version }), 'utf-8');
        } catch (e) {
                console.error(e);
        }
}

build();

if (process.argv.includes('--watch')) {
        fs.watch(rootPackageJsonPath, (event, filename) => {
                console.log(`update ${filename} ...`);
                build();
        });
}
