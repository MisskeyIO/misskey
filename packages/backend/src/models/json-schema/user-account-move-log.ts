/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const packedUserAccountMoveLogSchema = {
	type: 'object',
	properties: {
		id: { type: 'string', optional: false, nullable: false, format: 'id', example: 'xxxxxxxxxx' },
		createdAt: { type: 'string', optional: false, nullable: false, format: 'date-time' },
		movedToId: { type: 'string', optional: false, nullable: false, format: 'id' },
		movedTo: { type: 'object', ref: 'UserDetailedNotMe', optional: false, nullable: false },
		movedFromId: { type: 'string', optional: false, nullable: false, format: 'id' },
		movedFrom: { type: 'object', ref: 'UserDetailedNotMe', optional: false, nullable: false },
	},
} as const;
