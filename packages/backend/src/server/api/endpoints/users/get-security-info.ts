/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { UserProfilesRepository, UserSecurityKeysRepository, UsersRepository } from '@/models/_.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['users'],

	requireCredential: false,
	allowGet: true,
	cacheSec: 60,

	description: 'Show public account security signals for a user.',

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'ca29dd64-850b-4614-a6d9-3c5b7741d8be',
			httpStatusCode: 404,
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			twoFactorEnabled: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			securityKeys: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			usePasswordLessLogin: {
				type: 'boolean',
				optional: false, nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
	},
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.userSecurityKeysRepository)
		private userSecurityKeysRepository: UserSecurityKeysRepository,
	) {
		super(meta, paramDef, async (ps) => {
			const [user, profile] = await Promise.all([
				this.usersRepository.findOneBy({ id: ps.userId }),
				this.userProfilesRepository.findOneBy({ userId: ps.userId }),
			]);

			if (user == null || profile == null) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			return {
				twoFactorEnabled: profile.twoFactorEnabled,
				securityKeys: profile.twoFactorEnabled
					? await this.userSecurityKeysRepository.exists({ where: { userId: user.id } })
					: false,
				usePasswordLessLogin: profile.usePasswordLessLogin,
			};
		});
	}
}
