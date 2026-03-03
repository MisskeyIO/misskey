/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { AnnouncementsRepository, AnnouncementReadsRepository } from '@/models/_.js';
import type { MiAnnouncement } from '@/models/Announcement.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { AnnouncementService } from '@/core/AnnouncementService.js';
import { IdService } from '@/core/IdService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	kind: 'read:admin:announcements',

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
					example: 'xxxxxxxxxx',
				},
				createdAt: {
					type: 'string',
					optional: false, nullable: false,
					format: 'date-time',
				},
				updatedAt: {
					type: 'string',
					optional: false, nullable: true,
					format: 'date-time',
				},
				text: {
					type: 'string',
					optional: false, nullable: false,
				},
				title: {
					type: 'string',
					optional: false, nullable: false,
				},
				imageUrl: {
					type: 'string',
					optional: false, nullable: true,
				},
				icon: {
					type: 'string',
					optional: false, nullable: false,
				},
				display: {
					type: 'string',
					optional: false, nullable: false,
				},
				isActive: {
					type: 'boolean',
					optional: false, nullable: false,
				},
				forExistingUsers: {
					type: 'boolean',
					optional: false, nullable: false,
				},
				silence: {
					type: 'boolean',
					optional: false, nullable: false,
				},
				needConfirmationToRead: {
					type: 'boolean',
					optional: false, nullable: false,
				},
				needEnrollmentTutorialToRead: {
					type: 'boolean',
					optional: false, nullable: false,
				},
				closeDuration: {
					type: 'number',
					optional: false, nullable: false,
				},
				displayOrder: {
					type: 'number',
					optional: false, nullable: false,
				},
				userId: {
					type: 'string',
					optional: false, nullable: true,
				},
				user: {
					type: 'object',
					optional: false, nullable: true,
					ref: 'UserLite',
				},
				reads: {
					type: 'number',
					optional: false, nullable: false,
				},
				lastReadAt: {
					type: 'string',
					optional: false, nullable: true,
					format: 'date-time',
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		offset: { type: 'integer', default: 0 },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
		userId: { type: 'string', format: 'misskey:id', nullable: true },
		status: { type: 'string', enum: ['active', 'archived'], nullable: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private announcementService: AnnouncementService,

		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const announcements = await this.announcementService.list(ps.userId ?? null, ps.limit, ps.offset, me, ps.status ?? null);
			// FIXME Check 本流だと下のコードになっているので、announcementServiceを確認する
			// const query = this.queryService.makePaginationQuery(this.announcementsRepository.createQueryBuilder('announcement'), ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate);
			//
			// if (ps.status === 'archived') {
			// 	query.andWhere('announcement.isActive = false');
			// } else if (ps.status === 'active') {
			// 	query.andWhere('announcement.isActive = true');
			// }
			//
			// if (ps.userId) {
			// 	query.andWhere('announcement.userId = :userId', { userId: ps.userId });
			// } else {
			// 	query.andWhere('announcement.userId IS NULL');
			// }
			//
			// const announcements = await query.limit(ps.limit).getMany();
			//
			// const reads = new Map<MiAnnouncement, number>();
			//
			// for (const announcement of announcements) {
			// 	reads.set(announcement, await this.announcementReadsRepository.countBy({
			// 		announcementId: announcement.id,
			// 	}));
			// }

			return announcements.map(announcement => ({
				id: announcement.id,
				createdAt: this.idService.parse(announcement.id).date.toISOString(),
				updatedAt: announcement.updatedAt?.toISOString() ?? null,
				title: announcement.title,
				text: announcement.text,
				imageUrl: announcement.imageUrl,
				icon: announcement.icon,
				display: announcement.display,
				isActive: announcement.isActive,
				forExistingUsers: announcement.forExistingUsers,
				needConfirmationToRead: announcement.needConfirmationToRead,
				needEnrollmentTutorialToRead: announcement.needEnrollmentTutorialToRead,
				closeDuration: announcement.closeDuration,
				displayOrder: announcement.displayOrder,
				silence: announcement.silence,
				userId: announcement.userId,
				user: announcement.userInfo,
				reads: announcement.reads,
				lastReadAt: announcement.lastReadAt?.toISOString() ?? null,
			}));
		});
	}
}
