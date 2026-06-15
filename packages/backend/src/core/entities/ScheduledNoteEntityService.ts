/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { ScheduledNotesRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import type { MiScheduledNote } from '@/models/ScheduledNote.js';
import { bindThis } from '@/decorators.js';
import { Packed } from '@/misc/json-schema.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import { NoteEntityService } from './NoteEntityService.js';

@Injectable()
export class ScheduledNoteEntityService {
	constructor(
		@Inject(DI.scheduledNotesRepository)
		private scheduledNotesRepository: ScheduledNotesRepository,

		private driveFileEntityService: DriveFileEntityService,
		private noteEntityService: NoteEntityService,
	) {
	}

	@bindThis
	public async pack(
		src: MiScheduledNote['id'] | MiScheduledNote,
		me: { id: MiUser['id'] },
	) : Promise<Packed<'NoteDraft'>> {
		const item = typeof src === 'object' ? src : await this.scheduledNotesRepository.findOneByOrFail({ id: src, userId: me.id });

		const files = item.draft.files != null
			? await this.driveFileEntityService.packMany(item.draft.files)
			: await this.driveFileEntityService.packManyByIds(item.draft.fileIds);
		const renote = item.draft.renoteId ? await this.noteEntityService.pack(item.draft.renote ?? item.draft.renoteId, me, { detail: true }).catch((err: unknown) => {
			if (err instanceof EntityNotFoundError) return null;
			throw err;
		}) : undefined;
		const reply = item.draft.replyId ? await this.noteEntityService.pack(item.draft.reply ?? item.draft.replyId, me, { detail: false }).catch((err: unknown) => {
			if (err instanceof EntityNotFoundError) return null;
			throw err;
		}) : undefined;

		const poll = item.draft.poll ? {
			choices: item.draft.poll.choices,
			multiple: item.draft.poll.multiple,
			expiresAt: item.draft.poll.expiresAt == null ? undefined : new Date(item.draft.poll.expiresAt).toISOString(),
			expiredAfter: item.draft.poll.expiredAfter,
		} : null;

		return {
			id: item.id,
			createdAt: item.createdAt.toISOString(),
			updatedAt: item.createdAt.toISOString(),
			scheduledAt: item.scheduledAt?.getTime() ?? null,
			isActuallyScheduled: true,
			reason: item.reason ?? undefined,
			userId: item.userId,
			text: item.draft.text ?? null,
			cw: item.draft.cw ?? null,
			visibility: item.draft.visibility,
			localOnly: item.draft.localOnly,
			reactionAcceptance: item.draft.reactionAcceptance,
			visibleUserIds: item.draft.visibleUserIds,
			fileIds: item.draft.fileIds,
			files,
			poll,
			replyId: item.draft.replyId,
			renoteId: item.draft.renoteId,
			channelId: item.draft.channelId,
			channel: item.draft.channel ? {
				id: item.draft.channel.id,
				name: item.draft.channel.name,
				color: item.draft.channel.color,
				isSensitive: item.draft.channel.isSensitive,
				allowRenoteToExternal: item.draft.channel.allowRenoteToExternal,
				userId: item.draft.channel.userId,
			} : undefined,
			renote,
			reply,
		};
	}

	@bindThis
	public async packMany(
		drafts: (MiScheduledNote['id'] | MiScheduledNote)[],
		me: { id: MiUser['id'] },
	) : Promise<Packed<'NoteDraft'>[]> {
		return (await Promise.allSettled(drafts.map(x => this.pack(x, me))))
			.filter(result => result.status === 'fulfilled')
			.map(result => (result as PromiseFulfilledResult<Packed<'NoteDraft'>>).value);
	}
}
