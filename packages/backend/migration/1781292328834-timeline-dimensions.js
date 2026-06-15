/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class TimelineDimensions1781292328834 {
    name = 'TimelineDimensions1781292328834'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "dimensions" integer NOT NULL DEFAULT 10000`);
        await queryRunner.query(`ALTER TABLE "note" ADD "dimension" integer NOT NULL DEFAULT 0`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "dimension"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "dimensions"`);
    }
}
