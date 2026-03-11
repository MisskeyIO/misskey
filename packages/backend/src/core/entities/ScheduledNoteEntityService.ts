import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { ScheduledNotesRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import type { MiScheduledNote } from '@/models/ScheduledNote.js';
import { bindThis } from '@/decorators.js';
import { Packed } from '@/misc/json-schema.js';
import { IdService } from '@/core/IdService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import { UserEntityService } from './UserEntityService.js';

@Injectable()
export class ScheduledNoteEntityService {
	constructor(
		@Inject(DI.scheduledNotesRepository)
		private scheduledNotesRepository: ScheduledNotesRepository,

		private driveFileEntityService: DriveFileEntityService,
		private userEntityService: UserEntityService,
		private idService: IdService
	) {
	}

	@bindThis
	public async pack(
		src: MiScheduledNote['id'] | MiScheduledNote,
		me: { id: MiUser['id'] },
	) : Promise<Packed<'ScheduledNote'>> {
		const item = typeof src === 'object' ? src : await this.scheduledNotesRepository.findOneByOrFail({ id: src, userId: me.id });

		const channel = item.draft.channel ?? null;
		const renote = item.draft.renote ?? null;
		const reply = item.draft.reply ?? null;
		const [renoteUser, replyUser, files] = await Promise.all([
			renote ? this.userEntityService.pack(renote.user ?? renote.userId, me) : null,
			reply ? this.userEntityService.pack(reply.user ?? reply.userId, me) : null,
			item.draft.files ? this.driveFileEntityService.packMany(item.draft.files, me) : [],
		]);

		return {
			id: item.id,
			createdAt: this.idService.parse(item.id).date.toISOString(),
			scheduledAt: item.scheduledAt?.getTime() ?? null,
			reason: item.reason ?? undefined,
			channel: channel ? {
				id: channel.id,
				name: channel.name,
			} : undefined,
			renote: renote ? {
				id: renote.id,
				text: (renote.cw ?? renote.text)?.substring(0, 100) ?? null,
				user: renoteUser!,
			} : undefined,
			reply: reply ? {
				id: reply.id,
				text: (reply.cw ?? reply.text)?.substring(0, 100) ?? null,
				user: replyUser!,
			} : undefined,
			data: {
				text: item.draft.text ?? null,
				useCw: !!item.draft.cw,
				cw: item.draft.cw ?? null,
				visibility: item.draft.visibility as 'public' | 'followers' | 'home' | 'specified',
				localOnly: item.draft.localOnly ?? false,
				lang: item.draft.lang ?? null,
				dimension: typeof item.draft.dimension === 'number' ? item.draft.dimension : null,
				files,
				poll: item.draft.poll ? { ...item.draft.poll, expiresAt: item.draft.poll.expiresAt?.getTime() ?? null, expiredAfter: null } : null,
				visibleUserIds: item.draft.visibility === 'specified' ? item.draft.visibleUsers?.map(x => x.id) : undefined,
			},
		};
	}

	@bindThis
	public async packMany(
		drafts: (MiScheduledNote['id'] | MiScheduledNote)[],
		me: { id: MiUser['id'] },
	) : Promise<Packed<'ScheduledNote'>[]> {
		return (await Promise.allSettled(drafts.map(x => this.pack(x, me))))
			.filter(result => result.status === 'fulfilled')
			.map(result => (result as PromiseFulfilledResult<Packed<'ScheduledNote'>>).value);
	}
}
