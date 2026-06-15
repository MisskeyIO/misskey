/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomBytes } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { base64url, decodeProtectedHeader } from 'jose';
import type { MiSingleSignOnServiceProvider } from '@/models/SingleSignOnServiceProvider.js';
import type { SsoUserProfileClaims } from '@/server/sso/SsoRuntimeService.js';
import { createJwtIdentityToken, verifyJwtIdentityToken } from '@/server/sso/JWTIdentifyProviderService.js';

function createProvider(overrides: Partial<MiSingleSignOnServiceProvider> = {}): MiSingleSignOnServiceProvider {
	return {
		id: 'provider-id',
		createdAt: new Date('2026-01-01T00:00:00Z'),
		name: 'Provider',
		type: 'jwt',
		issuer: 'https://misskey.example',
		audience: ['https://service.example'],
		binding: 'post',
		acsUrl: 'https://service.example/sso',
		publicKey: base64url.encode(randomBytes(32)),
		privateKey: null,
		signatureAlgorithm: 'HS256',
		cipherAlgorithm: null,
		wantAuthnRequestsSigned: false,
		wantAssertionsSigned: true,
		wantEmailAddressNormalized: true,
		...overrides,
	};
}

const claims: SsoUserProfileClaims = {
	name: 'Alice (@alice)',
	given_name: 'Alice',
	family_name: '@alice',
	preferred_username: 'alice',
	profile: 'https://misskey.example/@alice',
	picture: 'https://misskey.example/avatar.png',
	email: 'alice@example.com',
	email_verified: true,
	mfa_enabled: true,
	updated_at: 1_767_225_600,
	admin: true,
	moderator: false,
	roles: ['role-public'],
};

describe('JWTIdentifyProviderService helpers', () => {
	test('creates a signed JWT with the expected protected header and claims', async () => {
		const provider = createProvider();
		const jwt = await createJwtIdentityToken(provider, 'user-id', claims);
		const payload = await verifyJwtIdentityToken(provider, jwt);

		expect(decodeProtectedHeader(jwt)).toMatchObject({ typ: 'JWT', alg: 'HS256' });
		expect(payload).toMatchObject({
			iss: provider.issuer,
			aud: provider.audience,
			sub: 'user-id',
			email: claims.email,
			roles: claims.roles,
		});
	});

	test('rejects a signed JWT for a different audience', async () => {
		const provider = createProvider();
		const jwt = await createJwtIdentityToken(provider, 'user-id', claims);

		await expect(verifyJwtIdentityToken(createProvider({ audience: ['https://other.example'] }), jwt)).rejects.toThrow();
	});

	test('creates and verifies an encrypted JWT when cipherAlgorithm is configured', async () => {
		const provider = createProvider({
			signatureAlgorithm: 'dir',
			cipherAlgorithm: 'A256GCM',
			publicKey: base64url.encode(randomBytes(32)),
		});
		const jwt = await createJwtIdentityToken(provider, 'user-id', claims);
		const payload = await verifyJwtIdentityToken(provider, jwt);

		expect(decodeProtectedHeader(jwt)).toMatchObject({ typ: 'JWT', alg: 'dir', enc: 'A256GCM' });
		expect(payload).toMatchObject({
			iss: provider.issuer,
			sub: 'user-id',
			email_verified: true,
		});
	});
});
