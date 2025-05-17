export class SSOWantEmailAddressNormalized1745247339195 {
    name = 'SSOWantEmailAddressNormalized1745247339195'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "sso_service_provider" ADD "wantEmailAddressNormalized" boolean NOT NULL DEFAULT true`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "sso_service_provider" DROP COLUMN "wantEmailAddressNormalized"`);
    }
}
