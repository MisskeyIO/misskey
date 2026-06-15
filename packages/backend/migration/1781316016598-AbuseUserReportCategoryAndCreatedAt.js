/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AbuseUserReportCategoryAndCreatedAt1781316016598 {
	name = 'AbuseUserReportCategoryAndCreatedAt1781316016598'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "abuse_user_report" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
		await queryRunner.query(`COMMENT ON COLUMN "abuse_user_report"."createdAt" IS 'The created date of the AbuseUserReport.'`);
		await queryRunner.query(`ALTER TABLE "abuse_user_report" ADD "category" character varying(20) NOT NULL DEFAULT 'other'`);
		await queryRunner.query(`CREATE INDEX "IDX_abuse_user_report_createdAt" ON "abuse_user_report" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_abuse_user_report_category" ON "abuse_user_report" ("category")`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "public"."IDX_abuse_user_report_category"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_abuse_user_report_createdAt"`);
		await queryRunner.query(`ALTER TABLE "abuse_user_report" DROP COLUMN "category"`);
		await queryRunner.query(`ALTER TABLE "abuse_user_report" DROP COLUMN "createdAt"`);
	}
}
