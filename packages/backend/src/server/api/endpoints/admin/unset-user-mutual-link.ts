/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserProfilesRepository, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'write:admin:user-mutual-link',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		itemId: { type: 'string' },
	},
	required: ['userId', 'itemId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const user = await this.usersRepository.findOneBy({ id: ps.userId });
			const userProfile = await this.userProfilesRepository.findOneBy({ userId: ps.userId });

			if (user == null || userProfile == null) throw new Error('user not found');

			const userMutualLinkSections = structuredClone(userProfile.mutualLinkSections);
			const mutualLinkSections = userProfile.mutualLinkSections.map(section => ({
				...section,
				mutualLinks: section.mutualLinks.filter(item => item.id !== ps.itemId),
			}));

			userProfile.mutualLinkSections = mutualLinkSections;
			await this.userProfilesRepository.save(userProfile);

			this.moderationLogService.log(me, 'unsetUserMutualLink', {
				userId: user.id,
				userUsername: user.username,
				userHost: user.host,
				userMutualLinkSections,
			});
		});
	}
}
