/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ads1722497970000 {
    name = 'ads1722497970000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ad" ADD "isNSFW" boolean DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user_profile" ADD "isNsfwAdVisible" boolean NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ad" DROP COLUMN "isNSFW"`);
        await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "isNsfwAdVisible"`);
    }
}
