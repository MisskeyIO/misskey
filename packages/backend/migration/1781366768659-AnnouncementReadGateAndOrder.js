/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AnnouncementReadGateAndOrder1781366768659 {
	name = 'AnnouncementReadGateAndOrder1781366768659'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "announcement" ADD "needEnrollmentTutorialToRead" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "announcement" ADD "closeDuration" integer NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE "announcement" ADD "displayOrder" integer NOT NULL DEFAULT 0`);
		await queryRunner.query(`CREATE INDEX "IDX_b64d293ca4bef21e91963054b0" ON "announcement" ("displayOrder") `);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "public"."IDX_b64d293ca4bef21e91963054b0"`);
		await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "displayOrder"`);
		await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "closeDuration"`);
		await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "needEnrollmentTutorialToRead"`);
	}
}
