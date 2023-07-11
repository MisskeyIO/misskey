export class UserannouncementV21689078380767 {
    name = 'UserannouncementV21689078380767'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcement" ADD COLUMN "closeDuration" integer`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "closeDuration"`);
    }
}
