/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddNoteDraftIdempotencyKey1788391182000 {
	name = 'AddNoteDraftIdempotencyKey1788391182000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_draft" ADD "idempotencyKey" character varying(64)`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_note_draft_user_idempotency" ON "note_draft" ("userId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "public"."IDX_note_draft_user_idempotency"`);
		await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "idempotencyKey"`);
	}
}
