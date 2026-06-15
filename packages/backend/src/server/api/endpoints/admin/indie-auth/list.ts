/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { IndieAuthClientsRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['admin', 'indie-auth'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'read:admin:indie-auth',

	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
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
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		offset: { type: 'integer', minimum: 0, default: 0 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.indieAuthClientsRepository)
		private indieAuthClientsRepository: IndieAuthClientsRepository,
	) {
		super(meta, paramDef, async (ps) => {
			const clients = await this.indieAuthClientsRepository.createQueryBuilder('client')
				.orderBy('client.createdAt', 'DESC')
				.offset(ps.offset)
				.limit(ps.limit)
				.getMany();

			return clients.map(client => ({
				id: client.id,
				createdAt: client.createdAt.toISOString(),
				name: client.name,
				redirectUris: client.redirectUris,
			}));
		});
	}
}
