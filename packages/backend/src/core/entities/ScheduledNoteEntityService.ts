import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { ScheduledNotesRepository, ChannelsRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import type { MiScheduledNote } from '@/models/ScheduledNote.js';
import { bindThis } from '@/decorators.js';
import { Packed } from '@/misc/json-schema.js';
import { IdService } from '@/core/IdService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import type { UserEntityService } from './UserEntityService.js';
import type { NoteEntityService } from './NoteEntityService.js';

@Injectable()
export class ScheduledNoteEntityService {
	constructor(
		@Inject(DI.scheduledNotesRepository)
		private scheduledNotesRepository: ScheduledNotesRepository,

		private driveFileEntityService: DriveFileEntityService,
		private userEntityService: UserEntityService,
		private noteEntityService: NoteEntityService,
		private idService: IdService
	) {
	}

	@bindThis
	public async pack(
		src: MiScheduledNote['id'] | MiScheduledNote,
		me: { id: MiUser['id'] },
	) : Promise<Packed<'NoteDraft'>> {
		const item = typeof src === 'object' ? src : await this.scheduledNotesRepository.findOneByOrFail({ id: src, userId: me.id });

		const channel = item.draft.channel ?? null;

		return {
			id: item.id,
			createdAt: this.idService.parse(item.id).date.toISOString(),
			scheduledAt: item.scheduledAt?.getTime() ?? null,
			isActuallyScheduled: item.scheduledAt != null,
			reason: item.reason ?? undefined,
			text: item.draft.text ?? null,
			cw: item.draft.cw ?? null,
			userId: item.userId,
			user: await this.userEntityService.pack(item.user ?? item.userId, me),
			replyId: item.draft.reply?.id ?? null,
			renoteId: item.draft.renote?.id ?? null,
			reply: item.draft.reply ? await this.noteEntityService.pack(item.draft.reply, me, { detail: false }) : undefined,
			renote: item.draft.renote ? await this.noteEntityService.pack(item.draft.renote, me, { detail: true }) : undefined,
			visibility: (item.draft.visibility ?? 'public') as 'public' | 'home' | 'followers' | 'specified',
			localOnly: item.draft.localOnly ?? false,
			reactionAcceptance: item.draft.reactionAcceptance ?? null,
			visibleUserIds: item.draft.visibleUsers?.map(x => x.id) ?? [],
			hashtag: null,
			fileIds: item.draft.files?.map(f => f.id) ?? [],
			files: item.draft.files ? await this.driveFileEntityService.packMany(item.draft.files, me) : [],
			channelId: channel?.id ?? null,
			channel: channel ? {
				id: channel.id,
				name: channel.name,
				color: channel.color,
				isSensitive: channel.isSensitive,
				allowRenoteToExternal: channel.allowRenoteToExternal,
				userId: channel.userId,
			} : undefined,
			poll: item.draft.poll ? {
				choices: item.draft.poll.choices,
				multiple: item.draft.poll.multiple,
				expiresAt: item.draft.poll.expiresAt?.toISOString(),
				expiredAfter: null,
			} : null,
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
