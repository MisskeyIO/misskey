export class AddUserLangShowHashtagsInAllLanguages1769296855147 {
    name = 'AddUserLangShowHashtagsInAllLanguages1769296855147'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_lang" ADD "showHashtagsInAllLanguages" boolean NOT NULL DEFAULT true`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_lang" DROP COLUMN "showHashtagsInAllLanguages"`);
    }
}
