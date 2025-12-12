export class BlockRemoteEmojis1765489609853 {
    name = 'BlockRemoteEmojis1765489609853'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "blockedRemoteCustomEmojis" character varying(1024) array NOT NULL DEFAULT '{}'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "blockedRemoteCustomEmojis"`);
    }
}
