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
			id: '8d69fdac-fa7c-42e4-ab21-f8ab32ec8825',
			httpStatusCode: 404,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', minLength: 1, maxLength: 512 },
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

			await this.indieAuthClientsRepository.delete(client.id);

			this.moderationLogService.log(me, 'deleteIndieAuthClient', {
				clientId: client.id,
				client,
			});
		});
	}
}
