/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { SingleSignOnServiceProvidersRepository } from '@/models/_.js';
import { singleSignOnServiceProviderBindings, singleSignOnServiceProviderTypes } from '@/models/SingleSignOnServiceProvider.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['admin', 'sso'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'read:admin:sso',

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
				type: { type: 'string', optional: false, nullable: false, enum: singleSignOnServiceProviderTypes },
				issuer: { type: 'string', optional: false, nullable: false },
				audience: {
					type: 'array',
					optional: false,
					nullable: false,
					items: { type: 'string', optional: false, nullable: false },
				},
				binding: { type: 'string', optional: false, nullable: false, enum: singleSignOnServiceProviderBindings },
				acsUrl: { type: 'string', optional: false, nullable: false },
				publicKey: { type: 'string', optional: false, nullable: false },
				signatureAlgorithm: { type: 'string', optional: false, nullable: false },
				cipherAlgorithm: { type: 'string', optional: false, nullable: true },
				wantAuthnRequestsSigned: { type: 'boolean', optional: false, nullable: false },
				wantAssertionsSigned: { type: 'boolean', optional: false, nullable: false },
				wantEmailAddressNormalized: { type: 'boolean', optional: false, nullable: false },
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
		@Inject(DI.singleSignOnServiceProvidersRepository)
		private singleSignOnServiceProvidersRepository: SingleSignOnServiceProvidersRepository,
	) {
		super(meta, paramDef, async (ps) => {
			const providers = await this.singleSignOnServiceProvidersRepository.createQueryBuilder('provider')
				.orderBy('provider.createdAt', 'DESC')
				.offset(ps.offset)
				.limit(ps.limit)
				.getMany();

			return providers.map(provider => ({
				id: provider.id,
				createdAt: provider.createdAt.toISOString(),
				name: provider.name,
				type: provider.type,
				issuer: provider.issuer,
				audience: provider.audience,
				binding: provider.binding,
				acsUrl: provider.acsUrl,
				publicKey: provider.publicKey,
				signatureAlgorithm: provider.signatureAlgorithm,
				cipherAlgorithm: provider.cipherAlgorithm,
				wantAuthnRequestsSigned: provider.wantAuthnRequestsSigned,
				wantAssertionsSigned: provider.wantAssertionsSigned,
				wantEmailAddressNormalized: provider.wantEmailAddressNormalized,
			}));
		});
	}
}
