/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { IndieAuthClientsRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';

export const meta = {
	tags: ['admin', 'indie-auth'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:indie-auth',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			id: { type: 'string', optional: false, nullable: false },
			createdAt: { type: 'string', optional: false, nullable: false, format: 'date-time' },
			name: { type: 'string', optional: false, nullable: true },
			redirectUris: {
				type: 'array',
				optional: false,
				nullable: false,
				items: { type: 'string', optional: false, nullable: false },
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', minLength: 1, maxLength: 512 },
		name: { type: 'string', nullable: true, maxLength: 256, default: null },
		redirectUris: {
			type: 'array',
			default: [],
			items: { type: 'string', minLength: 1, maxLength: 512 },
		},
	},
	required: ['id'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.indieAuthClientsRepository)
		private indieAuthClientsRepository: IndieAuthClientsRepository,

		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const client = await this.indieAuthClientsRepository.insertOne({
				id: ps.id,
				createdAt: new Date(),
				name: ps.name == null || ps.name === '' ? null : ps.name,
				redirectUris: ps.redirectUris,
			});

			this.moderationLogService.log(me, 'createIndieAuthClient', {
				clientId: client.id,
				client,
			});

			return {
				id: client.id,
				createdAt: client.createdAt.toISOString(),
				name: client.name,
				redirectUris: client.redirectUris,
			};
		});
	}
}
