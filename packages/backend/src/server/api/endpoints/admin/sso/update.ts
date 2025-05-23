import { Inject, Injectable } from '@nestjs/common';
import * as jose from 'jose';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { SingleSignOnServiceProviderRepository } from '@/models/_.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { genX509CertFromJWK } from '@/misc/gen-x509-cert-from-jwk.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:sso',

	errors: {
		noSuchSingleSignOnServiceProvider: {
			message: 'No such SSO Service Provider',
			code: 'NO_SUCH_SSO_SP',
			id: '2f481db0-23f5-4380-8cb8-704169ffb25b',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', nullable: false },
		name: { type: 'string', nullable: true },
		issuer: { type: 'string', nullable: false },
		audience: { type: 'array', items: { type: 'string', nullable: false } },
		binding: { type: 'string', enum: ['post', 'redirect'], nullable: false },
		acsUrl: { type: 'string', nullable: false },
		signatureAlgorithm: { type: 'string', nullable: false },
		cipherAlgorithm: { type: 'string', nullable: true },
		wantAuthnRequestsSigned: { type: 'boolean', nullable: false },
		wantAssertionsSigned: { type: 'boolean', nullable: false },
		wantEmailAddressNormalized: { type: 'boolean', nullable: false },
		regenerateCertificate: { type: 'boolean', nullable: true },
		secret: { type: 'string', nullable: true },
	},
	required: ['id'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.config)
		private config: Config,
		@Inject(DI.singleSignOnServiceProviderRepository)
		private singleSignOnServiceProviderRepository: SingleSignOnServiceProviderRepository,

		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const service = await this.singleSignOnServiceProviderRepository.findOneBy({ id: ps.id });

			if (service == null) throw new ApiError(meta.errors.noSuchSingleSignOnServiceProvider);

			const alg = ps.signatureAlgorithm ? ps.signatureAlgorithm : service.signatureAlgorithm;
			const { publicKey, privateKey } = ps.regenerateCertificate
				? await jose.generateKeyPair(alg, { extractable: true }).then(async keypair => ({
					publicKey: JSON.stringify(await jose.exportJWK(keypair.publicKey)),
					privateKey: JSON.stringify(await jose.exportJWK(keypair.privateKey)),
				}))
				: { publicKey: ps.secret ?? undefined, privateKey: undefined };

			const now = new Date();
			const tenYearsLaterTime = new Date(now.getTime());
			tenYearsLaterTime.setFullYear(tenYearsLaterTime.getFullYear() + 10);

			const x509Cert = service.type === 'saml' && ps.regenerateCertificate ? await genX509CertFromJWK(
				this.config.hostname,
				now,
				tenYearsLaterTime,
				publicKey ?? '',
				privateKey ?? '',
				alg,
			) : undefined;

			await this.singleSignOnServiceProviderRepository.update(service.id, {
				name: ps.name !== '' ? ps.name : null,
				createdAt: service.type === 'saml' && ps.regenerateCertificate ? now : undefined,
				issuer: ps.issuer,
				audience: ps.audience?.filter(i => i.length > 0),
				binding: ps.binding,
				acsUrl: ps.acsUrl,
				publicKey: service.type === 'saml' && ps.regenerateCertificate ? x509Cert : publicKey,
				privateKey: privateKey,
				signatureAlgorithm: ps.signatureAlgorithm,
				cipherAlgorithm: ps.cipherAlgorithm !== '' ? ps.cipherAlgorithm : null,
				wantAuthnRequestsSigned: ps.wantAuthnRequestsSigned,
				wantAssertionsSigned: ps.wantAssertionsSigned,
				wantEmailAddressNormalized: ps.wantEmailAddressNormalized,
			});

			const updatedService = await this.singleSignOnServiceProviderRepository.findOneByOrFail({ id: service.id });

			this.moderationLogService.log(me, 'updateSSOServiceProvider', {
				serviceId: service.id,
				before: service,
				after: updatedService,
			});
		});
	}
}
