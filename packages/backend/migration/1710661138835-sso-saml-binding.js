export class SsoSamlBinding1710661138835 {
    name = 'SsoSamlBinding1710661138835'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."sso_service_provider_binding_enum" AS ENUM('post', 'redirect')`);
        await queryRunner.query(`ALTER TABLE "sso_service_provider" ADD "binding" "public"."sso_service_provider_binding_enum"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "sso_service_provider" DROP COLUMN "binding"`);
        await queryRunner.query(`DROP TYPE "public"."sso_service_provider_binding_enum"`);
    }
}
