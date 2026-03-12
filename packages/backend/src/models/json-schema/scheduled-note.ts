/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const packedScheduledNoteSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
			example: 'xxxxxxxxxx',
		},
		createdAt: {
			type: 'string',
			optional: false, nullable: false,
			format: 'date-time',
		},
		scheduledAt: {
			type: 'number',
			optional: false, nullable: true,
		},
		reason: {
			type: 'string',
			optional: true, nullable: true,
		},
		channel: {
			type: 'object',
			optional: true, nullable: true,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
					example: 'xxxxxxxxxx',
				},
				name: {
					type: 'string',
					optional: false, nullable: false,
				},
			},
		},
		renote: {
			type: 'object',
			optional: true, nullable: true,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
					example: 'xxxxxxxxxx',
				},
				text: {
					type: 'string',
					optional: false, nullable: true,
				},
				user: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'UserLite',
				},
			},
		},
		reply: {
			type: 'object',
			optional: true, nullable: true,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
					example: 'xxxxxxxxxx',
				},
				text: {
					type: 'string',
					optional: false, nullable: true,
				},
				user: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'UserLite',
				},
			},
		},
		data: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				text: {
					type: 'string',
					optional: false, nullable: true,
				},
				useCw: {
					type: 'boolean',
					optional: false, nullable: false,
				},
				cw: {
					type: 'string',
					optional: false, nullable: true,
				},
				visibility: {
					type: 'string',
					optional: false, nullable: false,
					enum: ['public', 'home', 'followers', 'specified'],
				},
				localOnly: {
					type: 'boolean',
					optional: false, nullable: false,
				},
				lang: {
					type: 'string',
					optional: false, nullable: true,
				},
				dimension: {
					type: 'integer',
					optional: false, nullable: true,
				},
				files: {
					type: 'array',
					optional: false, nullable: false,
					items: {
						type: 'object',
						optional: false, nullable: false,
						ref: 'DriveFile',
					},
				},
				poll: {
					type: 'object',
					optional: false, nullable: true,
					properties: {
						choices: {
							type: 'array',
							optional: false, nullable: false,
							items: {
								type: 'string',
								optional: false, nullable: false,
							},
						},
						multiple: {
							type: 'boolean',
							optional: false, nullable: false,
						},
						expiresAt: {
							type: 'number',
							optional: false, nullable: true,
						},
						expiredAfter: {
							type: 'integer',
							optional: false, nullable: true,
							minimum: 1,
						},
					},
				},
				visibleUserIds: {
					type: 'array',
					optional: true, nullable: false,
					items: {
						type: 'string',
						optional: false, nullable: false,
						format: 'id',
					},
				},
			},
		},
	},
} as const;
