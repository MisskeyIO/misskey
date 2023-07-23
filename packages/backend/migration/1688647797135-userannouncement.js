export class Userannouncement1688647797135 {
    name = 'Userannouncement1688647797135'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcement" ADD COLUMN "userId" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "announcement" ADD COLUMN "closeDuration" integer NOT NULL DEFAULT 0`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "closeDuration"`);
    }
}
