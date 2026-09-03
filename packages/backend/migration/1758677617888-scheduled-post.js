/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ScheduledPost1758677617888 {
    name = 'ScheduledPost1758677617888'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        const table = await queryRunner.getTable('note_draft');
        if (table == null) throw new Error('note_draft table が見つかりません');

        const scheduledAt = table.findColumnByName('scheduledAt');
        if (scheduledAt == null) {
            await queryRunner.query(`ALTER TABLE "note_draft" ADD "scheduledAt" TIMESTAMP WITH TIME ZONE`);
        } else if (scheduledAt.type !== 'timestamp with time zone' || !scheduledAt.isNullable || scheduledAt.default != null) {
            throw new Error(`note_draft.scheduledAt の定義が不正です: type=${scheduledAt.type}, nullable=${scheduledAt.isNullable}, default=${scheduledAt.default}`);
        }

        const isActuallyScheduled = table.findColumnByName('isActuallyScheduled');
        if (isActuallyScheduled == null) {
            await queryRunner.query(`ALTER TABLE "note_draft" ADD "isActuallyScheduled" boolean NOT NULL DEFAULT false`);
        } else if (isActuallyScheduled.type !== 'boolean' || isActuallyScheduled.isNullable || !['false', false].includes(isActuallyScheduled.default)) {
            throw new Error(`note_draft.isActuallyScheduled の定義が不正です: type=${isActuallyScheduled.type}, nullable=${isActuallyScheduled.isNullable}, default=${isActuallyScheduled.default}`);
        }
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        const table = await queryRunner.getTable('note_draft');
        if (table == null) throw new Error('note_draft table が見つかりません');

        const scheduledAt = table.findColumnByName('scheduledAt');
        if (scheduledAt == null || scheduledAt.type !== 'timestamp with time zone' || !scheduledAt.isNullable || scheduledAt.default != null) {
            throw new Error('note_draft.scheduledAt の定義が不正です');
        }

        const isActuallyScheduled = table.findColumnByName('isActuallyScheduled');
        if (isActuallyScheduled == null || isActuallyScheduled.type !== 'boolean' || isActuallyScheduled.isNullable || !['false', false].includes(isActuallyScheduled.default)) {
            throw new Error('note_draft.isActuallyScheduled の定義が不正です');
        }

        await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "isActuallyScheduled"`);
        const [{ exists: usedByLegacy }] = await queryRunner.query(
            `SELECT EXISTS (SELECT 1 FROM "migrations" WHERE "name" = $1) AS "exists"`,
            ['NoteDraftIoFields1788353769000'],
        );
        if (!usedByLegacy) {
            await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "scheduledAt"`);
        }
    }
}
