/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export const singleSignOnServiceProviderTypes = ['saml', 'jwt'] as const;
export type SingleSignOnServiceProviderType = typeof singleSignOnServiceProviderTypes[number];

export const singleSignOnServiceProviderBindings = ['post', 'redirect'] as const;
export type SingleSignOnServiceProviderBinding = typeof singleSignOnServiceProviderBindings[number];

@Entity('sso_service_provider')
export class MiSingleSignOnServiceProvider {
	@PrimaryColumn('varchar', {
		length: 36,
	})
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		default: () => 'CURRENT_TIMESTAMP',
	})
	public createdAt: Date;

	@Column('varchar', {
		length: 256,
		nullable: true,
	})
	public name: string | null;

	@Column('enum', {
		enum: singleSignOnServiceProviderTypes,
	})
	public type: SingleSignOnServiceProviderType;

	@Column('varchar', {
		length: 512,
	})
	public issuer: string;

	@Column('varchar', {
		length: 512,
		array: true,
		default: '{}',
	})
	public audience: string[];

	@Column('enum', {
		enum: singleSignOnServiceProviderBindings,
	})
	public binding: SingleSignOnServiceProviderBinding;

	@Column('varchar', {
		length: 512,
	})
	public acsUrl: string;

	@Column('varchar', {
		length: 4096,
	})
	public publicKey: string;

	@Column('varchar', {
		length: 4096,
		nullable: true,
	})
	public privateKey: string | null;

	@Column('varchar', {
		length: 100,
	})
	public signatureAlgorithm: string;

	@Column('varchar', {
		length: 100,
		nullable: true,
	})
	public cipherAlgorithm: string | null;

	@Column('boolean', {
		default: false,
	})
	public wantAuthnRequestsSigned: boolean;

	@Column('boolean', {
		default: true,
	})
	public wantAssertionsSigned: boolean;

	@Column('boolean', {
		default: true,
	})
	public wantEmailAddressNormalized: boolean;
}
