export class MetaDimensions1766847224713 {
    name = 'MetaDimensions1766847224713'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "dimensions" integer NOT NULL DEFAULT 10000`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "dimensions"`);
    }
}
