/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import type { IndieAuthClientsRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';

export const meta = {
	tags: ['admin', 'indie-auth'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:indie-auth',

	errors: {
		noSuchIndieAuthClient: {
			message: 'No such IndieAuth client.',
			code: 'NO_SUCH_INDIE_AUTH_CLIENT',
			id: '7fbc7292-8dc8-4869-aa86-8733f538aeca',
			httpStatusCode: 404,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', minLength: 1, maxLength: 512 },
		name: { type: 'string', nullable: true, maxLength: 256 },
		redirectUris: {
			type: 'array',
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
			const client = await this.indieAuthClientsRepository.findOneBy({ id: ps.id });
			if (client == null) throw new ApiError(meta.errors.noSuchIndieAuthClient);

			const before = { ...client };
			if (ps.name !== undefined) client.name = ps.name == null || ps.name === '' ? null : ps.name;
			if (ps.redirectUris !== undefined) client.redirectUris = ps.redirectUris;
			const updatedClient = await this.indieAuthClientsRepository.save(client);

			this.moderationLogService.log(me, 'updateIndieAuthClient', {
				clientId: client.id,
				before,
				after: updatedClient,
			});
		});
	}
}
