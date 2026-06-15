/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { AntennasRepository, UserListsRepository } from '@/models/_.js';
import { FanoutTimelineService } from '@/core/FanoutTimelineService.js';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'],

	requireCredential: true,
	requiredRolePolicy: 'canDeleteContent',

	kind: 'write:account',

	errors: {
		noSuchList: {
			message: 'No such list.',
			code: 'NO_SUCH_LIST',
			id: '6a40c9e2-5dbd-42f5-91e3-85d5c4da8f3e',
		},

		noSuchAntenna: {
			message: 'No such antenna.',
			code: 'NO_SUCH_ANTENNA',
			id: 'dc0b9d49-f11a-4680-8ad8-22f032cc91f8',
		},

		missingTarget: {
			message: 'Target id is required.',
			code: 'TARGET_ID_REQUIRED',
			id: 'ed670b97-8c0e-42c6-84db-5f5d9fb2a6d6',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		type: { type: 'string', enum: ['home', 'user', 'list', 'antenna'] },
		listId: { type: 'string', format: 'misskey:id', nullable: true },
		antennaId: { type: 'string', format: 'misskey:id', nullable: true },
	},
	required: ['type'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private fanoutTimelineService: FanoutTimelineService,

		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,

		@Inject(DI.antennasRepository)
		private antennasRepository: AntennasRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const purge = async (...timelineNames: Parameters<FanoutTimelineService['purgeWithDimensions']>[0][]) => {
				await Promise.all(timelineNames.map(timelineName => this.fanoutTimelineService.purgeWithDimensions(timelineName)));
			};

			switch (ps.type) {
				case 'home': {
					await purge(`homeTimeline:${me.id}`, `homeTimelineWithFiles:${me.id}`);
					break;
				}

				case 'user': {
					await purge(
						`userTimeline:${me.id}`,
						`userTimelineWithFiles:${me.id}`,
						`userTimelineWithReplies:${me.id}`,
						`userTimelineWithChannel:${me.id}`,
					);
					break;
				}

				case 'list': {
					if (ps.listId == null) throw new ApiError(meta.errors.missingTarget);

					const userList = await this.userListsRepository.findOneBy({
						id: ps.listId,
						userId: me.id,
					});

					if (userList == null) throw new ApiError(meta.errors.noSuchList);

					await purge(`userListTimeline:${userList.id}`, `userListTimelineWithFiles:${userList.id}`);
					break;
				}

				case 'antenna': {
					if (ps.antennaId == null) throw new ApiError(meta.errors.missingTarget);

					const antenna = await this.antennasRepository.findOneBy({
						id: ps.antennaId,
						userId: me.id,
					});

					if (antenna == null) throw new ApiError(meta.errors.noSuchAntenna);

					await purge(`antennaTimeline:${antenna.id}`);
					break;
				}
			}
		});
	}
}
