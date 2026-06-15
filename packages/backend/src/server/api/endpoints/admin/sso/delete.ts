/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import type { SingleSignOnServiceProvidersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';

export const meta = {
	tags: ['admin', 'sso'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:sso',

	errors: {
		noSuchSingleSignOnServiceProvider: {
			message: 'No such SSO service provider.',
			code: 'NO_SUCH_SSO_SERVICE_PROVIDER',
			id: 'd33c0b1a-786c-432b-bcab-75d7420724ca',
			httpStatusCode: 404,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', minLength: 1, maxLength: 36 },
	},
	required: ['id'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.singleSignOnServiceProvidersRepository)
		private singleSignOnServiceProvidersRepository: SingleSignOnServiceProvidersRepository,

		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const provider = await this.singleSignOnServiceProvidersRepository.findOneBy({ id: ps.id });
			if (provider == null) throw new ApiError(meta.errors.noSuchSingleSignOnServiceProvider);

			await this.singleSignOnServiceProvidersRepository.delete(provider.id);

			this.moderationLogService.log(me, 'deleteSSOServiceProvider', {
				providerId: provider.id,
				provider,
			});
		});
	}
}
