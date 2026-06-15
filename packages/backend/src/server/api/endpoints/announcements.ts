/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import { AnnouncementEntityService } from '@/core/entities/AnnouncementEntityService.js';
import { AnnouncementService } from '@/core/AnnouncementService.js';

export const meta = {
	tags: ['meta'],

	requireCredential: false,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Announcement',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
		isActive: { type: 'boolean', default: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private queryService: QueryService,
		private announcementEntityService: AnnouncementEntityService,
		private announcementService: AnnouncementService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(this.announcementService.createVisibleAnnouncementsQuery(me, ps.isActive), ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate);
			this.announcementService.orderByDisplayOrder(query, ps);

			const announcements = await query.limit(ps.limit).getMany();

			return this.announcementEntityService.packMany(announcements, me);
		});
	}
}
