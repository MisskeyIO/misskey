export class AddIsSensitiveToAd1765736186185 {
    name = 'AddIsSensitiveToAd1765736186185'

    async up(queryRunner) {
        const table = await queryRunner.getTable('ad');
        if (table == null) throw new Error('ad table が見つかりません');

        const column = table.findColumnByName('imageBlurhash');
        if (column == null) {
            await queryRunner.query(`ALTER TABLE "ad" ADD "imageBlurhash" character varying(128)`);
        } else if (column.type !== 'character varying' || column.length !== '128' || !column.isNullable || column.default != null) {
            throw new Error(`ad.imageBlurhash の定義が不正です: type=${column.type}, length=${column.length}, nullable=${column.isNullable}, default=${column.default}`);
        }
    }

    async down(queryRunner) {
        const table = await queryRunner.getTable('ad');
        if (table == null) throw new Error('ad table が見つかりません');

        const column = table.findColumnByName('imageBlurhash');
        if (column == null || column.type !== 'character varying' || column.length !== '128' || !column.isNullable || column.default != null) {
            throw new Error('ad.imageBlurhash の定義が不正です');
        }

        await queryRunner.query(`ALTER TABLE "ad" DROP COLUMN "imageBlurhash"`);
    }
}
