/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class IndexScheduledNoteDraftRecovery1788391180000 {
	name = 'IndexScheduledNoteDraftRecovery1788391180000'

	async up(queryRunner) {
		await queryRunner.query('CREATE INDEX "IDX_note_draft_scheduled_recovery" ON "note_draft" ("scheduledAt", "id") WHERE "isActuallyScheduled" = true AND "scheduledFailureReason" IS NULL AND "scheduledAt" IS NOT NULL');
	}

	async down(queryRunner) {
		await queryRunner.query('DROP INDEX "public"."IDX_note_draft_scheduled_recovery"');
	}
}
