export class MigrateOtherLanguage1768823383293 {
    name = 'MigrateOtherLanguage1768823383293'

    async up(queryRunner) {
        await queryRunner.query(`UPDATE "user_lang" SET "postingLang" = 'other' WHERE "postingLang" IS NOT NULL AND "postingLang" NOT IN ('ja', 'ja-JP', 'ko', 'ko-KR', 'other')`);
        await queryRunner.query(`UPDATE "user_lang" SET "viewingLangs" = COALESCE((
            SELECT array_agg(DISTINCT mapped ORDER BY mapped)
            FROM (
                SELECT CASE
                    WHEN v IN ('ja', 'ja-JP', 'ko', 'ko-KR', 'other', 'unknown', 'remote') THEN v
                    ELSE 'other'
                END AS mapped
                FROM unnest("viewingLangs") AS v
            ) AS mapped_values
        ), '{}'::varchar[])`);
        await queryRunner.query(`UPDATE "note_lang" SET "lang" = 'other' WHERE "lang" NOT IN ('ja', 'ja-JP', 'ko', 'ko-KR', 'other')`);
    }

    async down(queryRunner) {
        await queryRunner.query(`SELECT 1`);
    }
}
