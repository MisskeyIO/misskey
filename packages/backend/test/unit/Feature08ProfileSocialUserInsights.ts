/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { mutualLinkSectionsSchema, packedMeDetailedOnlySchema, packedUserDetailedNotMeOnlySchema } from '@/models/json-schema/user.js';
import { meta as adminShowUserMeta } from '@/server/api/endpoints/admin/show-user.js';
import { normalizeMutualLinkSections, paramDef as iUpdateParamDef } from '@/server/api/endpoints/i/update.js';
import { meta as getSecurityInfoMeta } from '@/server/api/endpoints/users/get-security-info.js';
import { isSkebStatusResponse, meta as getSkebStatusMeta } from '@/server/api/endpoints/users/get-skeb-status.js';
import { meta as usersStatsMeta } from '@/server/api/endpoints/users/stats.js';

describe('Feature 08 profile social user insights API shape', () => {
	test('mutual link sections are exposed in user and admin schemas and accepted by i/update', () => {
		expect(packedUserDetailedNotMeOnlySchema.properties).toHaveProperty('mutualLinkSections');
		expect(packedMeDetailedOnlySchema.properties).not.toHaveProperty('mutualLinkSections');
		expect(adminShowUserMeta.res.properties).toHaveProperty('mutualLinkSections');
		expect(iUpdateParamDef.properties).toHaveProperty('mutualLinkSections');
		expect(mutualLinkSectionsSchema.items.properties.mutualLinks.maxItems).toBe(16);
	});

	test('mutual link section normalization trims and caps data', () => {
		const sections = normalizeMutualLinkSections([
			{
				id: ' section ',
				name: ' Friends ',
				mutualLinks: [
					{ id: ' one ', name: ' Alice ', url: ' https://example.com/alice ', avatarUrl: ' https://example.com/avatar.png ' },
					{ id: '   ', name: ' Empty id ' },
				],
			},
		]);

		expect(sections).toEqual([
			{
				id: 'section',
				name: 'Friends',
				mutualLinks: [
					{ id: 'one', name: 'Alice', url: 'https://example.com/alice', avatarUrl: 'https://example.com/avatar.png' },
				],
			},
		]);
	});

	test('new users endpoints expose privacy-safe contracts', () => {
		expect(usersStatsMeta.res.properties).toHaveProperty('driveUsage');
		expect(getSecurityInfoMeta.res.properties).toHaveProperty('twoFactorEnabled');
		expect(getSecurityInfoMeta.res.properties).toHaveProperty('securityKeys');
		expect(getSecurityInfoMeta.res.properties).not.toHaveProperty('password');
		expect(getSecurityInfoMeta.res.properties).not.toHaveProperty('email');
	});

	test('Skeb endpoint validates snake_case upstream response and returns camelCase schema', () => {
		expect(getSkebStatusMeta.res.properties).toHaveProperty('screenName');
		expect(getSkebStatusMeta.res.properties).toHaveProperty('isAcceptable');
		expect(isSkebStatusResponse({
			screen_name: 'creator',
			is_creator: true,
			is_acceptable: true,
			creator_request_count: 1,
			client_request_count: 2,
			skills: [{ amount: 3000, genre: 'art' }],
		})).toBe(true);
		expect(isSkebStatusResponse({
			screen_name: 'creator',
			is_creator: true,
			is_acceptable: true,
			creator_request_count: 1,
			client_request_count: 2,
			skills: [{ amount: 3000, genre: 'unknown' }],
		})).toBe(false);
	});
});
