/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, Scope } from '@nestjs/common';
import type { Packed } from '@/misc/json-schema.js';
import { MetaService } from '@/core/MetaService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteStreamingHidingService } from '../NoteStreamingHidingService.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type ChannelRequest } from '../channel.js';
import { REQUEST } from '@nestjs/core';

@Injectable({ scope: Scope.TRANSIENT })
export class HybridTimelineChannel extends Channel {
	public readonly chName = 'hybridTimeline';
	public static shouldShare = false;
	public static requireCredential = true as const;
	public static kind = 'read:account';
	private withRenotes: boolean;
	private withReplies: boolean;
	private withFiles: boolean;
	private minimize: boolean;

	constructor(
		@Inject(REQUEST)
		request: ChannelRequest,

		private metaService: MetaService,
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
		private noteStreamingHidingService: NoteStreamingHidingService,
	) {
		super(request);
		//this.onNote = this.onNote.bind(this);
	}

	@bindThis
	public async init(params: JsonObject): Promise<void> {
		const policies = await this.roleService.getUserPolicies(this.user ? this.user.id : null);
		if (!policies.ltlAvailable) return;

		this.withRenotes = !!(params.withRenotes ?? true);
		this.withReplies = !!(params.withReplies ?? false);
		this.withFiles = !!(params.withFiles ?? false);
		this.minimize = !!(params.minimize ?? false);

		// Subscribe events
		this.subscriber.on('notesStream', this.onNote);
	}

	@bindThis
	private async onNote(sourceNote: Packed<'Note'>) {
		let note = sourceNote;
		const isMe = this.user!.id === note.userId;

		// チャンネルの投稿ではなく、自分自身の投稿 または
		// チャンネルの投稿ではなく、その投稿のユーザーをフォローしている または
		// チャンネルの投稿ではなく、全体公開のローカルの投稿 または
		// フォローしているチャンネルの投稿 の場合だけ
		if (!(
			(note.channelId == null && isMe) ||
			(note.channelId == null && Object.hasOwn(this.following, note.userId)) ||
			(note.channelId == null && (note.user.host == null && note.visibility === 'public')) ||
			(note.channelId != null && this.followingChannels.has(note.channelId))
		)) return;

		// ファイルを含まない投稿は除外
		if (this.withFiles && (note.fileIds == null || note.fileIds.length === 0)) return;
		if (this.withFiles && (note.files === undefined || note.files.length === 0)) return;

		if (!this.isNoteVisibleForMe(note)) return;

		if (note.reply) {
			const reply = note.reply;
			if ((this.following[note.userId]?.withReplies ?? false) || this.withReplies) {
				// 自分のフォローしていないユーザーの visibility: followers な投稿への返信は弾く
				if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId) && reply.userId !== this.user!.id) return;
				// 自分の見ることができないユーザーの visibility: specified な投稿への返信は弾く
				if (reply.visibility === 'specified' && !reply.visibleUserIds!.includes(this.user!.id)) return;
			} else {
				// 「チャンネル接続主への返信」でもなければ、「チャンネル接続主が行った返信」でもなければ、「投稿者の投稿者自身への返信」でもない場合
				if (reply.userId !== this.user!.id && !isMe && reply.userId !== note.userId) return;
			}
		}

		// 純粋なリノート（引用リノートでないリノート）の場合
		if (note.renote && isRenotePacked(note) && !isQuotePacked(note)) {
			if (!this.withRenotes) return;
			if (note.renote.reply) {
				const reply = note.renote.reply;
				// 自分のフォローしていないユーザーの visibility: followers な投稿への返信のリノートは弾く
				if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId) && reply.userId !== this.user!.id) return;
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
	}

	@bindThis
	public dispose(): void {
		// Unsubscribe events
		this.subscriber.off('notesStream', this.onNote);
	}
}
