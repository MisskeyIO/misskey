export class MigrateOtherLanguage1768823383293 {
    name = 'MigrateOtherLanguage1768823383293'

    async up(queryRunner) {
        await queryRunner.query(`UPDATE "user_lang" SET "postingLang" = 'ja' WHERE "postingLang" LIKE 'ja-%'`);
        await queryRunner.query(`UPDATE "user_lang" SET "postingLang" = 'ko' WHERE "postingLang" LIKE 'ko-%'`);
        await queryRunner.query(`UPDATE "user_lang" SET "postingLang" = 'other' WHERE "postingLang" IS NOT NULL AND "postingLang" NOT IN ('ja', 'ko', 'other')`);
        await queryRunner.query(`UPDATE "user_lang" SET "viewingLangs" = COALESCE((
            SELECT array_agg(DISTINCT mapped ORDER BY mapped)
            FROM (
                SELECT CASE
                    WHEN v IN ('ja', 'ko', 'other', 'unknown', 'remote') THEN v
                    WHEN v LIKE 'ja-%' THEN 'ja'
                    WHEN v LIKE 'ko-%' THEN 'ko'
                    ELSE 'other'
                END AS mapped
                FROM unnest("viewingLangs") AS v
            ) AS mapped_values
        ), '{}'::varchar[])`);
        await queryRunner.query(`UPDATE "note_lang" SET "lang" = 'ja' WHERE "lang" LIKE 'ja-%'`);
        await queryRunner.query(`UPDATE "note_lang" SET "lang" = 'ko' WHERE "lang" LIKE 'ko-%'`);
        await queryRunner.query(`UPDATE "note_lang" SET "lang" = 'other' WHERE "lang" NOT IN ('ja', 'ko', 'other')`);
    }

    async down(queryRunner) {
        await queryRunner.query(`SELECT 1`);
    }
}
