export class InlinePolicy1765484922866 {
    name = 'InlinePolicy1765484922866'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "user_inline_policy" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" character varying(32) NOT NULL, "policy" character varying(128) NOT NULL, "operation" character varying(16) NOT NULL, "value" jsonb, "memo" character varying(2048), CONSTRAINT "PK_7ea05e75686f42c53dabdec7569" PRIMARY KEY ("id")); COMMENT ON COLUMN "user_inline_policy"."userId" IS 'The user ID for this inline policy.'`);
        await queryRunner.query(`CREATE INDEX "IDX_5633b94fd9db47bb8b959875fb" ON "user_inline_policy" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d5ef260c979cd48c00a987f27" ON "user_inline_policy" ("updatedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_608ad26d1bc7696a6acc8e9e55" ON "user_inline_policy" ("userId") `);
        await queryRunner.query(`ALTER TABLE "user_inline_policy" ADD CONSTRAINT "FK_608ad26d1bc7696a6acc8e9e551" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_inline_policy" DROP CONSTRAINT "FK_608ad26d1bc7696a6acc8e9e551"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_608ad26d1bc7696a6acc8e9e55"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d5ef260c979cd48c00a987f27"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5633b94fd9db47bb8b959875fb"`);
        await queryRunner.query(`DROP TABLE "user_inline_policy"`);
    }
}
