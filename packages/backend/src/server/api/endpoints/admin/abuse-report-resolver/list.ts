/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { QueryService } from '@/core/QueryService.js';
import { abuseReportResolverExpiresAtValues } from '@/models/AbuseReportResolver.js';
import type { AbuseReportResolversRepository } from '@/models/_.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'read:admin:abuse-report-resolvers',

	res: {
		type: 'array',
		items: {
			type: 'object',
			properties: {
				id: { type: 'string', nullable: false, optional: false, format: 'id' },
				createdAt: { type: 'string', nullable: false, optional: false, format: 'date-time' },
				updatedAt: { type: 'string', nullable: false, optional: false, format: 'date-time' },
				name: { type: 'string', nullable: false, optional: false },
				targetUserPattern: { type: 'string', nullable: true, optional: false },
				reporterPattern: { type: 'string', nullable: true, optional: false },
				reportContentPattern: { type: 'string', nullable: true, optional: false },
				expirationDate: { type: 'string', nullable: true, optional: false, format: 'date-time' },
				expiresAt: { type: 'string', nullable: false, optional: false, enum: abuseReportResolverExpiresAtValues },
				forward: { type: 'boolean', nullable: false, optional: false },
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
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.abuseReportResolversRepository)
		private abuseReportResolversRepository: AbuseReportResolversRepository,

		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps) => {
			const query = this.queryService.makePaginationQuery(this.abuseReportResolversRepository.createQueryBuilder('resolver'), ps.sinceId, ps.untilId)
				.andWhere(new Brackets(qb => {
					qb.where('resolver.expirationDate > :date', { date: new Date() });
					qb.orWhere('resolver.expirationDate IS NULL');
				}))
				.take(ps.limit);

			return (await query.getMany()).map(resolver => ({
				id: resolver.id,
				createdAt: resolver.createdAt.toISOString(),
				updatedAt: resolver.updatedAt.toISOString(),
				name: resolver.name,
				targetUserPattern: resolver.targetUserPattern,
				reporterPattern: resolver.reporterPattern,
				reportContentPattern: resolver.reportContentPattern,
				expirationDate: resolver.expirationDate?.toISOString() ?? null,
				expiresAt: resolver.expiresAt,
				forward: resolver.forward,
			}));
		});
	}
}
