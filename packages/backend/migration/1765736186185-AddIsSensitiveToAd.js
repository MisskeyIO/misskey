export class AddIsSensitiveToAd1765736186185 {
    name = 'AddIsSensitiveToAd1765736186185'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ad" ADD "isSensitive" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "ad" ADD "imageBlurhash" character varying(128)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ad" DROP COLUMN "imageBlurhash"`);
        await queryRunner.query(`ALTER TABLE "ad" DROP COLUMN "isSensitive"`);
    }
}
