/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NoteDraftIoFields1788353769000 {
    name = 'NoteDraftIoFields1788353769000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note_draft" ADD "dimension" integer`);
        await queryRunner.query(`ALTER TABLE "note_draft" ADD "lang" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "note_draft" ADD "scheduledAt" TIMESTAMP WITH TIME ZONE`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "scheduledAt"`);
        await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "lang"`);
        await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "dimension"`);
    }
}
