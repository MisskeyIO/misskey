/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserProfilesRepository, UserSecurityKeysRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['users'],

	requireCredential: false,
	res: {
		type: 'object',
		properties: {
			twoFactorEnabled: { type: 'boolean' },
			usePasswordLessLogin: { type: 'boolean' },
			securityKeys: { type: 'boolean' },
		},
	},
	errors: {
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		email: { type: 'string' },
	},
	required: ['email'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.userSecurityKeysRepository)
		private userSecurityKeysRepository: UserSecurityKeysRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const userProfile = await this.userProfilesRepository.findOneBy({
				email: ps.email,
			});

			return userProfile ? {
				twoFactorEnabled: userProfile.twoFactorEnabled,
				usePasswordLessLogin: userProfile.usePasswordLessLogin,
				securityKeys: userProfile.twoFactorEnabled
					? await this.userSecurityKeysRepository.countBy({ userId: userProfile.userId }).then(result => result >= 1)
					: false,
			} : {
				twoFactorEnabled: false,
				usePasswordLessLogin: false,
				securityKeys: false,
			};
		});
	}
}

