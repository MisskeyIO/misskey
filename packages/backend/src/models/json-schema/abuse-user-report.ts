/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const packedAbuseUserReportSchema = {
	type: 'object',
	properties: {
		id: { type: 'string', optional: false, nullable: false, format: 'id', example: 'xxxxxxxxxx' },
		createdAt: { type: 'string', optional: false, nullable: false, format: 'date-time' },
		comment: { type: 'string', optional: false, nullable: false },
		category: { type: 'string', optional: false, nullable: false },
		resolved: { type: 'boolean', optional: false, nullable: false },
		reporterId: { type: 'string', optional: false, nullable: false, format: 'id' },
		targetUserId: { type: 'string', optional: false, nullable: false, format: 'id' },
		assigneeId: { type: 'string', optional: false, nullable: true, format: 'id' },
		reporter: { type: 'object', optional: false, nullable: false, ref: 'UserDetailedNotMe' },
		targetUser: { type: 'object', optional: false, nullable: false, ref: 'UserDetailedNotMe' },
		assignee: { type: 'object', optional: false, nullable: true, ref: 'UserDetailedNotMe' },
		forwarded: { type: 'boolean', optional: false, nullable: false },
		resolvedAs: { type: 'string', optional: false, nullable: true, enum: ['accept', 'reject', null] },
		moderationNote: { type: 'string', optional: false, nullable: false },
	},
} as const;
