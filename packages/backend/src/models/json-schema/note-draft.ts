/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const packedNoteDraftSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			optional: false, nullable: false,
			format: 'misskey:id',
			example: 'xxxxxxxxxx',
		},
		createdAt: {
			type: 'string',
			optional: true, nullable: false,
			format: 'date-time',
		},
		updatedAt: {
			type: 'string',
			optional: true, nullable: false,
			format: 'date-time',
		},
		text: {
			type: 'string',
			optional: true, nullable: true,
		},
		cw: {
			type: 'string',
			optional: true, nullable: true,
		},
		userId: {
			type: 'string',
			optional: true, nullable: false,
			format: 'misskey:id',
		},
		user: {
			type: 'object',
			ref: 'UserLite',
			optional: true, nullable: false,
		},
		replyId: {
			type: 'string',
			optional: true, nullable: true,
			format: 'misskey:id',
		},
		renoteId: {
			type: 'string',
			optional: true, nullable: true,
			format: 'misskey:id',
		},
		reply: {
			type: 'object',
			optional: true, nullable: true,
			ref: 'Note',
		},
		renote: {
			type: 'object',
			optional: true, nullable: true,
			ref: 'Note',
		},
		visibility: {
			type: 'string',
			optional: true, nullable: false,
			enum: ['public', 'home', 'followers', 'specified'],
		},
		visibleUserIds: {
			type: 'array',
			optional: true, nullable: false,
			items: {
				type: 'string',
				optional: false, nullable: false,
				format: 'misskey:id',
			},
		},
		fileIds: {
			type: 'array',
			optional: true, nullable: false,
			items: {
				type: 'string',
				optional: false, nullable: false,
				format: 'misskey:id',
			},
		},
		files: {
			type: 'array',
			optional: true, nullable: false,
			items: {
				type: 'object',
				optional: false, nullable: false,
				ref: 'DriveFile',
			},
		},
		hashtag: {
			type: 'string',
			optional: true, nullable: true,
		},
		poll: {
			type: 'object',
			optional: true, nullable: true,
			properties: {
				expiresAt: {
					type: 'string',
					optional: true, nullable: true,
					format: 'date-time',
				},
				expiredAfter: {
					type: 'number',
					optional: true, nullable: true,
				},
				multiple: {
					type: 'boolean',
					optional: false, nullable: false,
				},
				choices: {
					type: 'array',
					optional: false, nullable: false,
					items: {
						type: 'string',
						optional: false, nullable: false,
					},
				},
			},
		},
		channelId: {
			type: 'string',
			optional: true, nullable: true,
			format: 'misskey:id',
		},
		channel: {
			type: 'object',
			optional: true, nullable: true,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
					format: 'misskey:id',
				},
				name: {
					type: 'string',
					optional: false, nullable: false,
				},
				color: {
					type: 'string',
					optional: true, nullable: false,
				},
				isSensitive: {
					type: 'boolean',
					optional: true, nullable: false,
				},
				allowRenoteToExternal: {
					type: 'boolean',
					optional: true, nullable: false,
				},
				userId: {
					type: 'string',
					optional: true, nullable: true,
					format: 'misskey:id',
				},
			},
		},
		localOnly: {
			type: 'boolean',
			optional: true, nullable: false,
		},
		reactionAcceptance: {
			type: 'string',
			optional: true, nullable: true,
			enum: ['likeOnly', 'likeOnlyForRemote', 'nonSensitiveOnly', 'nonSensitiveOnlyForLocalLikeOnlyForRemote', null],
		},
		scheduledAt: {
			type: 'number',
			optional: true, nullable: true,
		},
		isActuallyScheduled: {
			type: 'boolean',
			optional: true, nullable: false,
		},
		reason: {
			type: 'string',
			optional: true, nullable: false,
		},
		data: {
			type: 'object',
			optional: true, nullable: false,
			properties: {
				text: { type: 'string', optional: false, nullable: true },
				useCw: { type: 'boolean', optional: false, nullable: false },
				cw: { type: 'string', optional: false, nullable: true },
				visibility: { type: 'string', optional: false, nullable: false, enum: ['public', 'home', 'followers', 'specified'] },
				localOnly: { type: 'boolean', optional: false, nullable: false },
				lang: { type: 'string', optional: true, nullable: true },
				dimension: { type: 'integer', optional: true, nullable: true },
				files: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false, ref: 'DriveFile' } },
				poll: { type: 'object', optional: false, nullable: true },
				visibleUserIds: { type: 'array', optional: true, nullable: false, items: { type: 'string', optional: false, nullable: false, format: 'misskey:id' } },
			},
		},
	},
} as const;
