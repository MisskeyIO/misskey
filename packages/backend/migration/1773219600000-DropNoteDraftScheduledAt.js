export class DropNoteDraftScheduledAt1773219600000 {
	name = 'DropNoteDraftScheduledAt1773219600000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "scheduledAt"`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_draft" ADD "scheduledAt" TIMESTAMP WITH TIME ZONE`);
	}
}
