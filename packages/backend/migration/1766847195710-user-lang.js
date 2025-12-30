export class UserLangNoteLang1766847195710 {
    name = 'UserLangNoteLang1766847195710'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "user_lang" ("userId" character varying(32) NOT NULL, "postingLang" character varying(32), "viewingLangs" character varying(32) array NOT NULL DEFAULT '{}', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_user_lang" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`ALTER TABLE "user_lang" ADD CONSTRAINT "FK_user_lang_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TABLE "note_lang" ("noteId" character varying(32) NOT NULL, "lang" character varying(32) NOT NULL, CONSTRAINT "PK_note_lang" PRIMARY KEY ("noteId"))`);
        await queryRunner.query(`ALTER TABLE "note_lang" ADD CONSTRAINT "FK_note_lang_note" FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note_lang" DROP CONSTRAINT "FK_note_lang_note"`);
        await queryRunner.query(`DROP TABLE "note_lang"`);
        await queryRunner.query(`ALTER TABLE "user_lang" DROP CONSTRAINT "FK_user_lang_user"`);
        await queryRunner.query(`DROP TABLE "user_lang"`);
    }
}
