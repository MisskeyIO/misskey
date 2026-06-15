/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class EmojiAdminFieldsAndBlockedRemoteEmojis1781389238590 {
	name = 'EmojiAdminFieldsAndBlockedRemoteEmojis1781389238590'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "emoji" ADD "requestedBy" character varying(1024)`);
		await queryRunner.query(`ALTER TABLE "emoji" ADD "memo" character varying(8192) NOT NULL DEFAULT ''`);
		await queryRunner.query(`ALTER TABLE "emoji" ADD "roleIdsThatCanNotBeUsedThisEmojiAsReaction" character varying(128) array NOT NULL DEFAULT '{}'`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "blockedRemoteCustomEmojis" character varying(1024) array NOT NULL DEFAULT '{}'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "blockedRemoteCustomEmojis"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "roleIdsThatCanNotBeUsedThisEmojiAsReaction"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "memo"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "requestedBy"`);
	}
}
