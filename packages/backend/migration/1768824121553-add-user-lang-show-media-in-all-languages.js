export class AddUserLangShowMediaInAllLanguages1768824121553 {
    name = 'AddUserLangShowMediaInAllLanguages1768824121553'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_lang" ADD "showMediaInAllLanguages" boolean NOT NULL DEFAULT true`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_lang" DROP COLUMN "showMediaInAllLanguages"`);
    }
}
