/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { SingleSignOnServiceProvidersRepository } from '@/models/_.js';
import { singleSignOnServiceProviderBindings, singleSignOnServiceProviderTypes } from '@/models/SingleSignOnServiceProvider.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';

export const meta = {
	tags: ['admin', 'sso'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:sso',

	res: {
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
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', nullable: true, maxLength: 256, default: null },
		type: { type: 'string', enum: singleSignOnServiceProviderTypes },
		issuer: { type: 'string', minLength: 1, maxLength: 512 },
		audience: { type: 'array', default: [], items: { type: 'string', minLength: 1, maxLength: 512 } },
		binding: { type: 'string', enum: singleSignOnServiceProviderBindings },
		acsUrl: { type: 'string', minLength: 1, maxLength: 512 },
		publicKey: { type: 'string', minLength: 1, maxLength: 4096 },
		privateKey: { type: 'string', nullable: true, maxLength: 4096, default: null },
		signatureAlgorithm: { type: 'string', minLength: 1, maxLength: 100 },
		cipherAlgorithm: { type: 'string', nullable: true, maxLength: 100, default: null },
		wantAuthnRequestsSigned: { type: 'boolean', default: false },
		wantAssertionsSigned: { type: 'boolean', default: true },
		wantEmailAddressNormalized: { type: 'boolean', default: true },
	},
	required: ['type', 'issuer', 'binding', 'acsUrl', 'publicKey', 'signatureAlgorithm'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.singleSignOnServiceProvidersRepository)
		private singleSignOnServiceProvidersRepository: SingleSignOnServiceProvidersRepository,

		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const provider = await this.singleSignOnServiceProvidersRepository.insertOne({
				id: randomUUID(),
				createdAt: new Date(),
				name: ps.name == null || ps.name === '' ? null : ps.name,
				type: ps.type,
				issuer: ps.issuer,
				audience: ps.audience,
				binding: ps.binding,
				acsUrl: ps.acsUrl,
				publicKey: ps.publicKey,
				privateKey: ps.privateKey == null || ps.privateKey === '' ? null : ps.privateKey,
				signatureAlgorithm: ps.signatureAlgorithm,
				cipherAlgorithm: ps.cipherAlgorithm == null || ps.cipherAlgorithm === '' ? null : ps.cipherAlgorithm,
				wantAuthnRequestsSigned: ps.wantAuthnRequestsSigned,
				wantAssertionsSigned: ps.wantAssertionsSigned,
				wantEmailAddressNormalized: ps.wantEmailAddressNormalized,
			});

			this.moderationLogService.log(me, 'createSSOServiceProvider', {
				providerId: provider.id,
				provider,
			});

			return {
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
			};
		});
	}
}
