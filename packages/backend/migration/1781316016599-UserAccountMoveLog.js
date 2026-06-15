/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class UserAccountMoveLog1781316016599 {
	name = 'UserAccountMoveLog1781316016599'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "user_account_move_log" ("id" character varying(32) NOT NULL, "movedToId" character varying(32) NOT NULL, "movedFromId" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_user_account_move_log_id" PRIMARY KEY ("id")); COMMENT ON COLUMN "user_account_move_log"."createdAt" IS 'The created date of the UserAccountMoveLog.'`);
		await queryRunner.query(`CREATE INDEX "IDX_user_account_move_log_movedToId" ON "user_account_move_log" ("movedToId")`);
		await queryRunner.query(`CREATE INDEX "IDX_user_account_move_log_movedFromId" ON "user_account_move_log" ("movedFromId")`);
		await queryRunner.query(`ALTER TABLE "user_account_move_log" ADD CONSTRAINT "FK_user_account_move_log_movedToId" FOREIGN KEY ("movedToId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "user_account_move_log" ADD CONSTRAINT "FK_user_account_move_log_movedFromId" FOREIGN KEY ("movedFromId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_account_move_log" DROP CONSTRAINT "FK_user_account_move_log_movedFromId"`);
		await queryRunner.query(`ALTER TABLE "user_account_move_log" DROP CONSTRAINT "FK_user_account_move_log_movedToId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_user_account_move_log_movedFromId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_user_account_move_log_movedToId"`);
		await queryRunner.query(`DROP TABLE "user_account_move_log"`);
	}
}
