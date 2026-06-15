/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class RoleBadgeBehavior1781332228580 {
	name = 'RoleBadgeBehavior1781332228580'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "role" ADD "badgeBehavior" character varying(256)`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "badgeBehavior"`);
	}
}
