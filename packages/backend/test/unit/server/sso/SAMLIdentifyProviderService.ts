/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import type { MiSingleSignOnServiceProvider } from '@/models/SingleSignOnServiceProvider.js';
import { createSamlIdPMetadataXml, createSamlSPMetadataXml } from '@/server/sso/SAMLIdentifyProviderService.js';

const certificate = [
	'-----BEGIN CERTIFICATE-----',
	'MIICERTIFICATEBODY',
	'-----END CERTIFICATE-----',
].join('\n');

function createProvider(overrides: Partial<MiSingleSignOnServiceProvider> = {}): MiSingleSignOnServiceProvider {
	return {
		id: 'provider-id',
		createdAt: new Date('2026-01-01T00:00:00Z'),
		name: 'Provider',
		type: 'saml',
		issuer: 'https://service.example/metadata',
		audience: ['https://service.example/audience'],
		binding: 'post',
		acsUrl: 'https://service.example/acs',
		publicKey: certificate,
		privateKey: null,
		signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
		cipherAlgorithm: null,
		wantAuthnRequestsSigned: true,
		wantAssertionsSigned: true,
		wantEmailAddressNormalized: true,
		...overrides,
	};
}

describe('SAMLIdentifyProviderService metadata helpers', () => {
	test('creates IdP metadata with redirect and post SSO endpoints', () => {
		const xml = createSamlIdPMetadataXml(createProvider(), 'https://misskey.example');

		expect(xml).toContain('entityID="https://misskey.example/sso/saml/provider-id/metadata"');
		expect(xml).toContain('WantAuthnRequestsSigned="true"');
		expect(xml).toContain('Location="https://misskey.example/sso/saml/provider-id"');
		expect(xml).toContain('urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect');
		expect(xml).toContain('urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST');
		expect(xml).toContain('MIICERTIFICATEBODY');
		expect(xml).not.toContain('BEGIN CERTIFICATE');
	});

	test('creates SP metadata from provider ACS, binding, and encryption config', () => {
		const xml = createSamlSPMetadataXml(createProvider({
			binding: 'redirect',
			cipherAlgorithm: 'aes256-cbc',
		}));

		expect(xml).toContain('entityID="https://service.example/metadata"');
		expect(xml).toContain('Location="https://service.example/acs"');
		expect(xml).toContain('urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect');
		expect(xml).toContain('use="encryption"');
		expect(xml).toContain('http://www.w3.org/2001/04/xmlenc#aes256-cbc');
	});
});
