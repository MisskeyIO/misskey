 /*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import type { Packed } from '@/misc/json-schema.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { JsonObject } from '@/misc/json-value.js';
import { NoteStreamingHidingService } from '../NoteStreamingHidingService.js';
import Channel, { type MiChannelService } from '../channel.js';

class ChannelChannel extends Channel {
	public readonly chName = 'channel';
	public static readonly shouldShare = false;
	public static readonly requireCredential = false as const;
	private channelId: string;
	private minimize: boolean;

	constructor(
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
		private noteStreamingHidingService: NoteStreamingHidingService,
		id: string,
		connection: Channel['connection'],
		dimension?: number | null,
	) {
		super(id, connection, dimension);
		//this.onNote = this.onNote.bind(this);
	}

	@bindThis
	public async init(params: JsonObject) {
		if (typeof params.channelId !== 'string') return false;
		this.channelId = params.channelId;
		this.minimize = !!(params.minimize ?? false);

		// Subscribe stream
		this.subscriber.on('notesStream', this.onNote);

		return true;
	}

	@bindThis
	private async onNote(note: Packed<'Note'>) {
		if (note.channelId !== this.channelId) return;

		if (note.reply) {
			const reply = note.reply;
			if (!this.isNoteVisibleForMe(reply)) return;
		}

		if (!this.shouldDeliverByDimension(note)) return;

		if (!(await this.noteEntityService.isLanguageVisibleToMe(note, this.user?.id))) return;

		if (!this.isNoteVisibleForMe(note)) return;
		if (this.isNoteMutedOrBlocked(note)) return;

		const { shouldSkip } = await this.noteStreamingHidingService.processHiding(note, this.user?.id ?? null);
		if (shouldSkip) return;

		if (this.user) {
			if (isRenotePacked(note) && !isQuotePacked(note)) {
				if (note.renote && Object.keys(note.renote.reactions).length > 0) {
					const myRenoteReaction = await this.noteEntityService.populateMyReaction(note.renote, this.user.id);
					note.renote.myReaction = myRenoteReaction;
				}
			}
		}

		if (this.user && (note.visibleUserIds?.includes(this.user.id) ?? note.mentions?.includes(this.user.id))) {
			this.connection.cacheNote(note);
		}

		if (this.minimize && ['public', 'home'].includes(note.visibility)) {
			const badgeRoles = this.iAmModerator ? await this.roleService.getUserBadgeRoles(note.userId, false) : undefined;

			this.send('note', {
				id: note.id, myReaction: note.myReaction,
				poll: note.poll?.choices ? { choices: note.poll.choices } : undefined,
				reply: note.reply?.myReaction ? { myReaction: note.reply.myReaction } : undefined,
				renote: note.renote?.myReaction ? { myReaction: note.renote.myReaction } : undefined,
				...(badgeRoles?.length ? { user: { badgeRoles } } : {}),
			});
		} else {
			this.send('note', note);
		}
	}

	@bindThis
	public dispose() {
		// Unsubscribe events
		this.subscriber.off('notesStream', this.onNote);
	}
}

@Injectable()
export class ChannelChannelService implements MiChannelService<false> {
	public readonly shouldShare = ChannelChannel.shouldShare;
	public readonly requireCredential = ChannelChannel.requireCredential;
	public readonly kind = ChannelChannel.kind;

	constructor(
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
		private noteStreamingHidingService: NoteStreamingHidingService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection'], dimension?: number | null): ChannelChannel {
		return new ChannelChannel(
			this.roleService,
			this.noteEntityService,
			this.noteStreamingHidingService,
			id,
			connection,
			dimension,
		);
	}
}
