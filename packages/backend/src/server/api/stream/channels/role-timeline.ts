/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, Scope } from '@nestjs/common';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { NoteStreamingHidingService } from '../NoteStreamingHidingService.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type ChannelRequest } from '../channel.js';
import { REQUEST } from '@nestjs/core';

@Injectable({ scope: Scope.TRANSIENT })
export class RoleTimelineChannel extends Channel {
	public readonly chName = 'roleTimeline';
	public static shouldShare = false;
	public static requireCredential = false as const;
	private roleId: string;
	private minimize: boolean;

	constructor(
		@Inject(REQUEST)
		request: ChannelRequest,

		private noteEntityService: NoteEntityService,
		private roleService: RoleService,
		private noteStreamingHidingService: NoteStreamingHidingService,
	) {
		super(request);
		//this.onNote = this.onNote.bind(this);
	}

	@bindThis
	public async init(params: JsonObject) {
		if (typeof params.roleId !== 'string') return;
		this.roleId = params.roleId;
		this.minimize = !!(params.minimize ?? false);

		this.subscriber.on(`roleTimelineStream:${this.roleId}`, this.onEvent);
	}

	@bindThis
	private async onEvent(data: GlobalEvents['roleTimeline']['payload']) {
		if (data.type === 'note') {
			let note = data.body;

			if (!(await this.roleService.isExplorable({ id: this.roleId }))) {
				return;
			}
			if (note.visibility !== 'public') return;
			if (note.user.requireSigninToViewContents && this.user == null) return;
			if (note.renote && note.renote.user.requireSigninToViewContents && this.user == null) return;
			if (note.reply && note.reply.user.requireSigninToViewContents && this.user == null) return;

			if (note.reply) {
				const reply = note.reply;
				// 自分のフォローしていないユーザーの visibility: followers な投稿への返信は弾く
				if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId)) return;
				// 自分の見ることができないユーザーの visibility: specified な投稿への返信は弾く
				if (reply.visibility === 'specified' && (this.user == null || !reply.visibleUserIds?.includes(this.user.id))) return;
			}

			// 純粋なリノート（引用リノートでないリノート）の場合
			if (note.renote && isRenotePacked(note) && !isQuotePacked(note)) {
				if (note.renote.reply) {
					const reply = note.renote.reply;
					// 自分のフォローしていないユーザーの visibility: followers な投稿への返信のリノートは弾く
					if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId)) return;
				}
			}

			if (!this.shouldDeliverByDimension(note)) return;

			if (!(await this.noteEntityService.isLanguageVisibleToMe(note, this.user?.id))) return;

			if (this.isNoteMutedOrBlocked(note)) return;

			const filtered = await this.noteStreamingHidingService.filter(note, this.user?.id ?? null);
			if (!filtered) return;
			note = filtered;

			if (this.user && isRenotePacked(note) && !isQuotePacked(note)) {
				if (note.renote && Object.keys(note.renote.reactions).length > 0) {
					const myRenoteReaction = await this.noteEntityService.populateMyReaction(note.renote, this.user.id);
					note = { ...note, renote: { ...note.renote, myReaction: myRenoteReaction } };
				}
			}

			if (this.minimize && this.canUseNoteJsonCache(note)) {
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
