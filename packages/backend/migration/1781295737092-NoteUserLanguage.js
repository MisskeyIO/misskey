/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NoteUserLanguage1781295737092 {
    name = 'NoteUserLanguage1781295737092'

    async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "user_lang" ("userId" character varying(32) NOT NULL, "postingLang" character varying(32), "viewingLangs" character varying(32) array NOT NULL DEFAULT '{}', "showMediaInAllLanguages" boolean NOT NULL DEFAULT true, "showHashtagsInAllLanguages" boolean NOT NULL DEFAULT true, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e503b4e6baed994ad0b1e90d3da" PRIMARY KEY ("userId"))`);
		await queryRunner.query(`CREATE TABLE "note_lang" ("noteId" character varying(32) NOT NULL, "lang" character varying(32) NOT NULL, CONSTRAINT "PK_7fd5e5edaacd0f66bed06ce3a93" PRIMARY KEY ("noteId"))`);
		await queryRunner.query(`ALTER TABLE "user_lang" ADD CONSTRAINT "FK_e503b4e6baed994ad0b1e90d3da" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "note_lang" ADD CONSTRAINT "FK_7fd5e5edaacd0f66bed06ce3a93" FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_lang" DROP CONSTRAINT "FK_7fd5e5edaacd0f66bed06ce3a93"`);
		await queryRunner.query(`ALTER TABLE "user_lang" DROP CONSTRAINT "FK_e503b4e6baed994ad0b1e90d3da"`);
        await queryRunner.query(`DROP TABLE "note_lang"`);
        await queryRunner.query(`DROP TABLE "user_lang"`);
    }
}
