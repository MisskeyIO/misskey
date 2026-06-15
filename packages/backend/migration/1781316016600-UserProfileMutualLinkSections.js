/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class UserProfileMutualLinkSections1781316016600 {
	name = 'UserProfileMutualLinkSections1781316016600'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "mutualLinkSections" jsonb NOT NULL DEFAULT '[]'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "mutualLinkSections"`);
	}
}
