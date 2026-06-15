/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import type { SingleSignOnServiceProvidersRepository } from '@/models/_.js';
import { singleSignOnServiceProviderBindings } from '@/models/SingleSignOnServiceProvider.js';
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
			id: '1ea6fc91-74fb-40cd-bef5-c9949ca66cef',
			httpStatusCode: 404,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', minLength: 1, maxLength: 36 },
		name: { type: 'string', nullable: true, maxLength: 256 },
		issuer: { type: 'string', minLength: 1, maxLength: 512 },
		audience: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 512 } },
		binding: { type: 'string', enum: singleSignOnServiceProviderBindings },
		acsUrl: { type: 'string', minLength: 1, maxLength: 512 },
		publicKey: { type: 'string', minLength: 1, maxLength: 4096 },
		privateKey: { type: 'string', nullable: true, maxLength: 4096 },
		signatureAlgorithm: { type: 'string', minLength: 1, maxLength: 100 },
		cipherAlgorithm: { type: 'string', nullable: true, maxLength: 100 },
		wantAuthnRequestsSigned: { type: 'boolean' },
		wantAssertionsSigned: { type: 'boolean' },
		wantEmailAddressNormalized: { type: 'boolean' },
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

			const before = { ...provider };
			if (ps.name !== undefined) provider.name = ps.name == null || ps.name === '' ? null : ps.name;
			if (ps.issuer !== undefined) provider.issuer = ps.issuer;
			if (ps.audience !== undefined) provider.audience = ps.audience;
			if (ps.binding !== undefined) provider.binding = ps.binding;
			if (ps.acsUrl !== undefined) provider.acsUrl = ps.acsUrl;
			if (ps.publicKey !== undefined) provider.publicKey = ps.publicKey;
			if (ps.privateKey !== undefined) provider.privateKey = ps.privateKey == null || ps.privateKey === '' ? null : ps.privateKey;
			if (ps.signatureAlgorithm !== undefined) provider.signatureAlgorithm = ps.signatureAlgorithm;
			if (ps.cipherAlgorithm !== undefined) provider.cipherAlgorithm = ps.cipherAlgorithm == null || ps.cipherAlgorithm === '' ? null : ps.cipherAlgorithm;
			if (ps.wantAuthnRequestsSigned !== undefined) provider.wantAuthnRequestsSigned = ps.wantAuthnRequestsSigned;
			if (ps.wantAssertionsSigned !== undefined) provider.wantAssertionsSigned = ps.wantAssertionsSigned;
			if (ps.wantEmailAddressNormalized !== undefined) provider.wantEmailAddressNormalized = ps.wantEmailAddressNormalized;
			const updatedProvider = await this.singleSignOnServiceProvidersRepository.save(provider);

			this.moderationLogService.log(me, 'updateSSOServiceProvider', {
				providerId: provider.id,
				before,
				after: updatedProvider,
			});
		});
	}
}
