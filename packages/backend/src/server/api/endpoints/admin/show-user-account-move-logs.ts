import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import type { UserAccountMoveLogRepository } from '@/models/_.js';
import { UserAccountMoveLogEntityService } from '@/core/entities/UserAccountMoveLogEntityService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	kind: 'read:admin:show-account-move-log',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
				},
				createdAt: {
					type: 'string',
					optional: false, nullable: false,
					format: 'date-time',
				},
				movedToId: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
				},
				movedTo: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'UserDetailed',
				},
				movedFromId: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
				},
				movedFrom: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'UserDetailed',
				},
			},
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
		toLocal: { type: 'boolean', nullable: true },
		fromLocal: { type: 'boolean', nullable: true },
		toFromLocal: { type: 'boolean', nullable: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userAccountMoveLogRepository)
		private userAccountMoveLogRepository: UserAccountMoveLogRepository,

		private userAccountMoveLogEntityService: UserAccountMoveLogEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(this.userAccountMoveLogRepository.createQueryBuilder('accountMoveLogs'), ps.sinceId, ps.untilId);

			if (ps.movedFromId != null) {
				query.andWhere('accountMoveLogs.movedFromId = :movedFromId', { movedFromId: ps.movedFromId });
			}

			if (ps.movedToId != null) {
				query.andWhere('accountMoveLogs.movedToId = :movedToId', { movedToId: ps.movedToId });
			}

			if (ps.toLocal || ps.fromLocal || ps.toFromLocal) {
				query.innerJoin('accountMoveLogs.movedTo', 'movedTo')
					.innerJoin('accountMoveLogs.movedFrom', 'movedFrom');
			}

			if (ps.toLocal && ps.fromLocal) {
				query.andWhere('(movedTo.host IS NULL OR movedFrom.host IS NULL)');
			} else {
				if (ps.toLocal) {
					query.andWhere('movedFrom.host IS NULL');
					query.andWhere('movedTo.host IS NOT NULL');
				}
				if (ps.fromLocal) {
					query.andWhere('movedTo.host IS NULL');
					query.andWhere('movedFrom.host IS NOT NULL');
				}
			}

			if (ps.toFromLocal) {
				query.andWhere('movedTo.host IS NULL AND movedFrom.host IS NULL');
			}

			const accountMoveLogs = await query.limit(ps.limit).getMany();

			return await this.userAccountMoveLogEntityService.packMany(accountMoveLogs, me);
		});
	}
}
