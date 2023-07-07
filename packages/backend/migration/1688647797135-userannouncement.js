export class Userannouncement1688647797135 {
    name = 'Userannouncement1688647797135'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcement" ADD COLUMN "userId" character varying(64)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "userId"`);  
    }
}
