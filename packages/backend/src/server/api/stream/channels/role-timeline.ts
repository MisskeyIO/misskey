/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteStreamingHidingService } from '../NoteStreamingHidingService.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import type { JsonObject } from '@/misc/json-value.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import Channel, { type MiChannelService } from '../channel.js';

class RoleTimelineChannel extends Channel {
	public readonly chName = 'roleTimeline';
	public static readonly shouldShare = false;
	public static readonly requireCredential = false as const;
	private roleId: string;
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
		if (typeof params.roleId !== 'string') return false;
		this.roleId = params.roleId;
		this.minimize = !!(params.minimize ?? false);

		this.subscriber.on(`roleTimelineStream:${this.roleId}`, this.onEvent);

		return true;
	}

	@bindThis
	private async onEvent(data: GlobalEvents['roleTimeline']['payload']) {
		if (data.type === 'note') {
			const note = data.body;

			if (!(await this.roleService.isExplorable({ id: this.roleId }))) {
				return;
			}
			if (note.visibility !== 'public') return;
			if (note.user.requireSigninToViewContents && this.user == null) return;
			if (note.renote && note.renote.user.requireSigninToViewContents && this.user == null) return;
			if (note.reply && note.reply.user.requireSigninToViewContents && this.user == null) return;
			if (!this.isNoteVisibleForMe(note)) return;

			if (note.reply) {
				const reply = note.reply;
				if (!this.isNoteVisibleForMe(reply)) return;
			}

			// 純粋なリノート（引用リノートでないリノート）の場合
			if (note.renote && isRenotePacked(note) && !isQuotePacked(note)) {
				if (note.renote.reply) {
					const reply = note.renote.reply;
					if (!this.isNoteVisibleForMe(reply)) return;
				}
			}

			if (!this.shouldDeliverByDimension(note)) return;

			if (!(await this.noteEntityService.isLanguageVisibleToMe(note, this.user?.id))) return;

			if (this.isNoteMutedOrBlocked(note)) return;

			const { shouldSkip } = await this.noteStreamingHidingService.processHiding(note, this.user?.id ?? null);
			if (shouldSkip) return;

			let noteToSend = note;
			if (this.user && isRenotePacked(note) && !isQuotePacked(note)) {
				if (note.renote && Object.keys(note.renote.reactions).length > 0) {
					const myRenoteReaction = await this.noteEntityService.populateMyReaction(note.renote, this.user.id);
					noteToSend = {
						...note,
						renote: {
							...note.renote,
							myReaction: myRenoteReaction,
						},
					};
				}
			}

			if (this.user && (note.visibleUserIds?.includes(this.user.id) ?? note.mentions?.includes(this.user.id))) {
				this.connection.cacheNote(note);
			}

			if (this.minimize && ['public', 'home'].includes(note.visibility)) {
				const badgeRoles = this.iAmModerator ? await this.roleService.getUserBadgeRoles(note.userId, false) : undefined;

				this.send('note', {
					id: noteToSend.id, myReaction: noteToSend.myReaction,
					poll: noteToSend.poll?.choices ? { choices: noteToSend.poll.choices } : undefined,
					reply: noteToSend.reply?.myReaction ? { myReaction: noteToSend.reply.myReaction } : undefined,
					renote: noteToSend.renote?.myReaction ? { myReaction: noteToSend.renote.myReaction } : undefined,
					...(badgeRoles?.length ? { user: { badgeRoles } } : {}),
				});
			} else {
				this.send('note', noteToSend);
			}
		} else {
			this.send(data.type, data.body);
		}
	}

	@bindThis
	public dispose() {
		// Unsubscribe events
		this.subscriber.off(`roleTimelineStream:${this.roleId}`, this.onEvent);
	}
}

@Injectable()
export class RoleTimelineChannelService implements MiChannelService<false> {
	public readonly shouldShare = RoleTimelineChannel.shouldShare;
	public readonly requireCredential = RoleTimelineChannel.requireCredential;
	public readonly kind = RoleTimelineChannel.kind;

	constructor(
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
		private noteStreamingHidingService: NoteStreamingHidingService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection'], dimension?: number | null): RoleTimelineChannel {
		return new RoleTimelineChannel(
			this.roleService,
			this.noteEntityService,
			this.noteStreamingHidingService,
			id,
			connection,
			dimension,
		);
	}
}
