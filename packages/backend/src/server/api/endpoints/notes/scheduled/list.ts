import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { ScheduledNotesRepository } from '@/models/_.js';
import { ScheduledNoteEntityService } from '@/core/entities/ScheduledNoteEntityService.js';
import { LEGACY_SCHEDULED_NOTE_MIGRATED, LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL } from '@/models/ScheduledNote.js';

export const meta = {
	tags: ['notes'],

	requireCredential: true,
	requireRolePolicy: 'canScheduleNote',

	kind: 'write:notes',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'ScheduledNote',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		offset: { type: 'integer', default: 0 },
	},
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.scheduledNotesRepository)
		private scheduledNotesRepository: ScheduledNotesRepository,

		private scheduledNoteEntityService: ScheduledNoteEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.scheduledNotesRepository.createQueryBuilder('draft')
				.where('draft.userId = :userId', { userId: me.id })
				.andWhere('(draft.reason IS NULL OR draft.reason <> :migrated)', { migrated: LEGACY_SCHEDULED_NOTE_MIGRATED })
				.andWhere(LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL);
			const drafts = await query.orderBy('draft.scheduledAt', 'ASC', 'NULLS FIRST').offset(ps.offset).limit(ps.limit).getMany();

			return await this.scheduledNoteEntityService.packMany(drafts, me);
		});
	}
}
