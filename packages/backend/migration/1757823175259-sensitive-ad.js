/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class SensitiveAd1757823175259 {
    name = 'SensitiveAd1757823175259'

    async up(queryRunner) {
        const table = await queryRunner.getTable('ad');
        if (table == null) throw new Error('ad table が見つかりません');

        const column = table.findColumnByName('isSensitive');
        if (column == null) {
            await queryRunner.query(`ALTER TABLE "ad" ADD "isSensitive" boolean NOT NULL DEFAULT false`);
        } else if (column.type !== 'boolean' || column.isNullable || !['false', false].includes(column.default)) {
            throw new Error(`ad.isSensitive の定義が不正です: type=${column.type}, nullable=${column.isNullable}, default=${column.default}`);
        }
    }

    async down(queryRunner) {
        const table = await queryRunner.getTable('ad');
        if (table == null) throw new Error('ad table が見つかりません');

        const column = table.findColumnByName('isSensitive');
        if (column == null || column.type !== 'boolean' || column.isNullable || !['false', false].includes(column.default)) {
            throw new Error('ad.isSensitive の定義が不正です');
        }

        const [{ exists: usedByLegacy }] = await queryRunner.query(
            `SELECT EXISTS (SELECT 1 FROM "migrations" WHERE "name" = $1) AS "exists"`,
            ['AddIsSensitiveToAd1765736186185'],
        );
        if (!usedByLegacy) {
            await queryRunner.query(`ALTER TABLE "ad" DROP COLUMN "isSensitive"`);
        }
    }
}
