export class PageIsPublic1731806320819 {
	name = 'PageIsPublic1731806320819'

	async up(queryRunner) {
		await queryRunner.query(`DROP INDEX "public"."IDX_90148bbc2bf0854428786bfc15"`);
		await queryRunner.query(`ALTER TABLE "page" DROP COLUMN "visibility"`);
		await queryRunner.query(`DROP TYPE "public"."page_visibility_enum"`);
		await queryRunner.query(`ALTER TABLE "page" DROP COLUMN "visibleUserIds"`);
		await queryRunner.query(`ALTER TABLE "page" ADD "isPublish" boolean NOT NULL DEFAULT true`);
		await queryRunner.query(`CREATE INDEX "IDX_dce798cab7e5478ba4fc15e515" ON "page" ("isPublish") `);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "public"."IDX_dce798cab7e5478ba4fc15e515"`);
		await queryRunner.query(`CREATE TYPE "public"."user_profile_followersVisibility_enum_old" AS ENUM('public', 'followers', 'private')`);
		await queryRunner.query(`ALTER TABLE "page" ADD "visibleUserIds" character varying(32) array NOT NULL DEFAULT '{}'`);
		await queryRunner.query(`CREATE TYPE "public"."page_visibility_enum" AS ENUM('public', 'followers', 'specified')`);
		await queryRunner.query(`ALTER TABLE "page" ADD "visibility" "public"."page_visibility_enum" NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_90148bbc2bf0854428786bfc15" ON "page" ("visibleUserIds") `);
	}
}
