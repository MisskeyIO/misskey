/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import type { UserAccountMoveLogsRepository } from '@/models/_.js';
import { UserAccountMoveLogEntityService } from '@/core/entities/UserAccountMoveLogEntityService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'read:admin:show-account-move-log',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'UserAccountMoveLog',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		movedFromId: { type: 'string', format: 'misskey:id', nullable: true },
		movedToId: { type: 'string', format: 'misskey:id', nullable: true },
		from: { type: 'string', enum: ['local', 'remote', 'all'], nullable: true },
		to: { type: 'string', enum: ['local', 'remote', 'all'], nullable: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userAccountMoveLogsRepository)
		private userAccountMoveLogsRepository: UserAccountMoveLogsRepository,

		private userAccountMoveLogEntityService: UserAccountMoveLogEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(this.userAccountMoveLogsRepository.createQueryBuilder('accountMoveLog'), ps.sinceId, ps.untilId);

			if (ps.movedFromId != null) {
				query.andWhere('accountMoveLog.movedFromId = :movedFromId', { movedFromId: ps.movedFromId });
			}

			if (ps.movedToId != null) {
				query.andWhere('accountMoveLog.movedToId = :movedToId', { movedToId: ps.movedToId });
			}

			if (ps.from != null || ps.to != null) {
				query
					.innerJoin('accountMoveLog.movedFrom', 'movedFrom')
					.innerJoin('accountMoveLog.movedTo', 'movedTo');

				if (ps.from === 'local') query.andWhere('movedFrom.host IS NULL');
				if (ps.from === 'remote') query.andWhere('movedFrom.host IS NOT NULL');
				if (ps.to === 'local') query.andWhere('movedTo.host IS NULL');
				if (ps.to === 'remote') query.andWhere('movedTo.host IS NOT NULL');
			}

			const accountMoveLogs = await query.limit(ps.limit).getMany();

			return await this.userAccountMoveLogEntityService.packMany(accountMoveLogs, me);
		});
	}
}
