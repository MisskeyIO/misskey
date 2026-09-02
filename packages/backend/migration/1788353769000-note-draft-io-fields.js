/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NoteDraftIoFields1788353769000 {
    name = 'NoteDraftIoFields1788353769000'

    async up(queryRunner) {
        const table = await queryRunner.getTable('note_draft');
        if (table == null) throw new Error('note_draft table が見つかりません');

        const dimension = table.findColumnByName('dimension');
        if (dimension == null) {
            await queryRunner.query(`ALTER TABLE "note_draft" ADD "dimension" integer`);
        } else if (dimension.type !== 'integer' || !dimension.isNullable || dimension.default != null) {
            throw new Error(`note_draft.dimension の定義が不正です: type=${dimension.type}, nullable=${dimension.isNullable}, default=${dimension.default}`);
        }

        const lang = table.findColumnByName('lang');
        if (lang == null) {
            await queryRunner.query(`ALTER TABLE "note_draft" ADD "lang" character varying(32)`);
        } else if (lang.type !== 'character varying' || lang.length !== '32' || !lang.isNullable || lang.default != null) {
            throw new Error(`note_draft.lang の定義が不正です: type=${lang.type}, length=${lang.length}, nullable=${lang.isNullable}, default=${lang.default}`);
        }
    }

    async down(queryRunner) {
        const table = await queryRunner.getTable('note_draft');
        if (table == null) throw new Error('note_draft table が見つかりません');

        const dimension = table.findColumnByName('dimension');
        if (dimension == null || dimension.type !== 'integer' || !dimension.isNullable || dimension.default != null) {
            throw new Error('note_draft.dimension の定義が不正です');
        }

        const lang = table.findColumnByName('lang');
        if (lang == null || lang.type !== 'character varying' || lang.length !== '32' || !lang.isNullable || lang.default != null) {
            throw new Error('note_draft.lang の定義が不正です');
        }

        await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "lang"`);
        await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "dimension"`);
    }
}
