/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from 'node:fs';
import { compiledConfigFilePath } from '../src-js/config.js';

export class MigrateSomeConfigFileSettingsToMeta1746949539915 {
    name = 'MigrateSomeConfigFileSettingsToMeta1746949539915'

    static loadCompiledConfig() {
        return JSON.parse(fs.readFileSync(compiledConfigFilePath, 'utf-8'));
    }

    async up(queryRunner) {
        const config = MigrateSomeConfigFileSettingsToMeta1746949539915.loadCompiledConfig();
        const [{ hasMeta }] = await queryRunner.query(`SELECT EXISTS (SELECT 1 FROM "meta") AS "hasMeta"`);
        const proxyRemoteFiles = Boolean(config.proxyRemoteFiles ?? !hasMeta);
        const signToActivityPubGet = Boolean(config.signToActivityPubGet ?? true);
        const allowExternalApRedirect = !Boolean(config.disallowExternalApRedirect ?? false);

        // $1 cannot be used in ALTER TABLE queries
        await queryRunner.query(`ALTER TABLE "meta" ADD "proxyRemoteFiles" boolean NOT NULL DEFAULT ${proxyRemoteFiles}`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "signToActivityPubGet" boolean NOT NULL DEFAULT ${signToActivityPubGet}`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "allowExternalApRedirect" boolean NOT NULL DEFAULT ${allowExternalApRedirect}`);
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "proxyRemoteFiles" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "signToActivityPubGet" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "allowExternalApRedirect" SET DEFAULT true`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "allowExternalApRedirect"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "signToActivityPubGet"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "proxyRemoteFiles"`);
    }
}
