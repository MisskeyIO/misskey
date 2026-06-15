/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AbuseReportResolver1781316016597 {
	name = 'AbuseReportResolver1781316016597'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TYPE "public"."abuse_report_resolver_expiresat_enum" AS ENUM('1hour', '12hours', '1day', '1week', '1month', '3months', '6months', '1year', 'indefinitely')`);
		await queryRunner.query(`CREATE TABLE "abuse_report_resolver" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(256) NOT NULL, "targetUserPattern" character varying(1024), "reporterPattern" character varying(1024), "reportContentPattern" character varying(1024), "expirationDate" TIMESTAMP WITH TIME ZONE, "expiresAt" "public"."abuse_report_resolver_expiresat_enum" NOT NULL, "forward" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_abuse_report_resolver_id" PRIMARY KEY ("id")); COMMENT ON COLUMN "abuse_report_resolver"."createdAt" IS 'The created date of the AbuseReportResolver.'; COMMENT ON COLUMN "abuse_report_resolver"."updatedAt" IS 'The updated date of AbuseReportResolver'; COMMENT ON COLUMN "abuse_report_resolver"."expirationDate" IS 'The expiration date of AbuseReportResolver'`);
		await queryRunner.query(`CREATE INDEX "IDX_abuse_report_resolver_createdAt" ON "abuse_report_resolver" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_abuse_report_resolver_updatedAt" ON "abuse_report_resolver" ("updatedAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_abuse_report_resolver_expirationDate" ON "abuse_report_resolver" ("expirationDate")`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "public"."IDX_abuse_report_resolver_expirationDate"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_abuse_report_resolver_updatedAt"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_abuse_report_resolver_createdAt"`);
		await queryRunner.query(`DROP TABLE "abuse_report_resolver"`);
		await queryRunner.query(`DROP TYPE "public"."abuse_report_resolver_expiresat_enum"`);
	}
}
