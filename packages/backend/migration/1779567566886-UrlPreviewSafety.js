/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class UrlPreviewSafety1779567566886 {
	name = 'UrlPreviewSafety1779567566886'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" ADD "urlPreviewDenyList" character varying(1024) array NOT NULL DEFAULT '{}'`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "wellKnownWebsites" character varying(1024) array NOT NULL DEFAULT '{}'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "wellKnownWebsites"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "urlPreviewDenyList"`);
	}
}
