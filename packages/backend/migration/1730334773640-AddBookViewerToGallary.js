export class AddBookViewerToGallary1730334773640 {
    name = 'AddBookViewerToGallary1730334773640'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "gallery_post" ADD "viewSettings" json`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "gallery_post" DROP COLUMN "viewSettings"`);
    }
}
