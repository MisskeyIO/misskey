/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const constraintName = 'FK_fd25dfe3da37df1715f11ba6ec8';

export class RestoreAnnouncementUserForeignKey1788391181000 {
	name = 'RestoreAnnouncementUserForeignKey1788391181000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "announcement" ADD CONSTRAINT "${constraintName}" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID`);

		const [{ count }] = await queryRunner.query(`SELECT COUNT(*)::integer AS "count" FROM "announcement" LEFT JOIN "user" ON "user"."id" = "announcement"."userId" WHERE "announcement"."userId" IS NOT NULL AND "user"."id" IS NULL`);
		if (count !== 0) {
			throw new Error(`個人向けお知らせに存在しないユーザー参照が${count}件あります`);
		}

		await queryRunner.query(`ALTER TABLE "announcement" VALIDATE CONSTRAINT "${constraintName}"`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "announcement" DROP CONSTRAINT "${constraintName}"`);
	}
}
