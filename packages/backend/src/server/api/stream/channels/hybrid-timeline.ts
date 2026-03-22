/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type { Packed } from '@/misc/json-schema.js';
import { MetaService } from '@/core/MetaService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteStreamingHidingService } from '../NoteStreamingHidingService.js';
import { RoleService } from '@/core/RoleService.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

class HybridTimelineChannel extends Channel {
	public readonly chName = 'hybridTimeline';
	public static readonly shouldShare = false;
	public static readonly requireCredential = true as const;
	public static readonly kind = 'read:account';
	private withRenotes: boolean;
	private withReplies: boolean;
	private withFiles: boolean;
	private minimize: boolean;

	constructor(
		private metaService: MetaService,
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
	public async init(params: JsonObject): Promise<boolean> {
		const policies = await this.roleService.getUserPolicies(this.user ? this.user.id : null);
		if (!policies.ltlAvailable) return false;

		this.withRenotes = !!(params.withRenotes ?? true);
		this.withReplies = !!(params.withReplies ?? false);
		this.withFiles = !!(params.withFiles ?? false);
		this.minimize = !!(params.minimize ?? false);

		// Subscribe events
		this.subscriber.on('notesStream', this.onNote);

		return true;
	}

	@bindThis
	private async onNote(note: Packed<'Note'>) {
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
		if (this.isNoteMutedOrBlocked(note)) return;

		if (note.reply) {
			const reply = note.reply;
			if ((this.following[note.userId]?.withReplies ?? false) || this.withReplies) {
				if (!this.isNoteVisibleForMe(reply)) return;
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
				if (!this.isNoteVisibleForMe(reply)) return;
			}
		}

		if (!this.shouldDeliverByDimension(note)) return;

		if (!(await this.noteEntityService.isLanguageVisibleToMe(note, this.user?.id))) return;

		const { shouldSkip } = await this.noteStreamingHidingService.processHiding(note, this.user?.id ?? null);
		if (shouldSkip) return;

		let noteToSend = note;
		if (this.user && isRenotePacked(note) && !isQuotePacked(note)) {
			if (note.renote?.reactions && Object.keys(note.renote.reactions).length > 0) {
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
	}

	@bindThis
	public dispose(): void {
		// Unsubscribe events
		this.subscriber.off('notesStream', this.onNote);
	}
}

@Injectable()
export class HybridTimelineChannelService implements MiChannelService<true> {
	public readonly shouldShare = HybridTimelineChannel.shouldShare;
	public readonly requireCredential = HybridTimelineChannel.requireCredential;
	public readonly kind = HybridTimelineChannel.kind;

	constructor(
		private metaService: MetaService,
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
		private noteStreamingHidingService: NoteStreamingHidingService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection'], dimension?: number | null): HybridTimelineChannel {
		return new HybridTimelineChannel(
			this.metaService,
			this.roleService,
			this.noteEntityService,
			this.noteStreamingHidingService,
			id,
			connection,
			dimension,
		);
	}
}
