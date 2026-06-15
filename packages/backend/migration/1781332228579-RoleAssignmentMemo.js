/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class RoleAssignmentMemo1781332228579 {
	name = 'RoleAssignmentMemo1781332228579'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "role_assignment" ADD "memo" character varying(256)`);
		await queryRunner.query(`COMMENT ON COLUMN "role_assignment"."memo" IS 'memo for the role assignment'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`COMMENT ON COLUMN "role_assignment"."memo" IS 'memo for the role assignment'`);
		await queryRunner.query(`ALTER TABLE "role_assignment" DROP COLUMN "memo"`);
	}
}
