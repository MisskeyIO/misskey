import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { ScheduledNotesRepository } from '@/models/_.js';
import { QueueService } from '@/core/QueueService.js';
import { ApiError } from '@/server/api/error.js';
import { LEGACY_SCHEDULED_NOTE_MIGRATED, LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL } from '@/models/ScheduledNote.js';

export const meta = {
	tags: ['notes'],

	requireCredential: true,
	requireRolePolicy: 'canCreateContent',

	prohibitMoved: true,

	limit: {
		duration: ms('1hour'),
		max: 300,
	},

	kind: 'write:notes',

	errors: {
		noSuchDraft: {
			message: 'No such draft',
			code: 'NO_SUCH_DRAFT',
			id: '91c2ad21-fb45-4f2a-ba4c-ea749b262947',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		draftId: { type: 'string', format: 'misskey:id' },
	},
	required: ['draftId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.scheduledNotesRepository)
		private scheduledNotesRepository: ScheduledNotesRepository,

		private queueService: QueueService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const draft = await this.scheduledNotesRepository.createQueryBuilder('draft')
				.where('draft.id = :id', { id: ps.draftId })
				.andWhere('draft.userId = :userId', { userId: me.id })
				.andWhere('(draft.reason IS NULL OR draft.reason <> :migrated)', { migrated: LEGACY_SCHEDULED_NOTE_MIGRATED })
				.andWhere(LEGACY_SCHEDULED_NOTE_NOT_MIGRATED_SQL)
				.getOne();
			if (!draft) throw new ApiError(meta.errors.noSuchDraft);

			await this.queueService.systemQueue.remove(`scheduledNote-${draft.id}`);
			const result = await this.scheduledNotesRepository.createQueryBuilder().delete()
				.where('id = :id', { id: draft.id })
				.andWhere('"userId" = :userId', { userId: me.id })
				.andWhere('(reason IS NULL OR reason <> :migrated)', { migrated: LEGACY_SCHEDULED_NOTE_MIGRATED })
				.andWhere('NOT EXISTS (SELECT 1 FROM "note_scheduled_migration" migration WHERE migration."noteScheduledId" = "note_scheduled".id)')
				.execute();
			if (result.affected !== 1) throw new ApiError(meta.errors.noSuchDraft);
		});
	}
}
