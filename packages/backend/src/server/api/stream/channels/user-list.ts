/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { MiUserListMembership, UserListMembershipsRepository, UserListsRepository } from '@/models/_.js';
import type { Packed } from '@/misc/json-schema.js';
import { RoleService } from '@/core/RoleService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import Channel, { type MiChannelService } from '../channel.js';

class UserListChannel extends Channel {
	public readonly chName = 'userList';
	public static readonly shouldShare = false;
	public static readonly requireCredential = false as const;
	private listId: string;
	private membershipsMap: Record<string, Pick<MiUserListMembership, 'withReplies'> | undefined> = {};
	private listUsersClock: NodeJS.Timeout;
	private withFiles: boolean;
	private withRenotes: boolean;
	private minimize: boolean;

	constructor(
		private userListsRepository: UserListsRepository,
		private userListMembershipsRepository: UserListMembershipsRepository,
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.updateListUsers = this.updateListUsers.bind(this);
		//this.onNote = this.onNote.bind(this);
	}

	@bindThis
	public async init(params: any) {
		this.listId = params.listId as string;
		this.withFiles = params.withFiles ?? false;
		this.withRenotes = params.withRenotes ?? true;
		this.minimize = params.minimize ?? false;

		// Check existence and owner
		const listExist = await this.userListsRepository.exists({
			where: {
				id: this.listId,
				userId: this.user!.id,
			},
		});
		if (!listExist) return;

		// Subscribe stream
		this.subscriber.on(`userListStream:${this.listId}`, this.send);

		this.subscriber.on('notesStream', this.onNote);

		this.updateListUsers();
		this.listUsersClock = setInterval(this.updateListUsers, 5000);
	}

	@bindThis
	private async updateListUsers() {
		const memberships = await this.userListMembershipsRepository.find({
			where: {
				userListId: this.listId,
			},
			select: ['userId'],
		});

		const membershipsMap: Record<string, Pick<MiUserListMembership, 'withReplies'> | undefined> = {};
		for (const membership of memberships) {
			membershipsMap[membership.userId] = {
				withReplies: membership.withReplies,
			};
		}
		this.membershipsMap = membershipsMap;
	}

	@bindThis
	private async onNote(note: Packed<'Note'>) {
		const isMe = this.user!.id === note.userId;

		// チャンネル投稿は無視する
		if (note.channelId) return;

		// ファイルを含まない投稿は除外
		if (this.withFiles && (note.fileIds == null || note.fileIds.length === 0)) return;
		if (this.withFiles && (note.files === undefined || note.files.length === 0)) return;

		if (!Object.hasOwn(this.membershipsMap, note.userId)) return;

		if (note.visibility === 'followers') {
			if (!isMe && !Object.hasOwn(this.following, note.userId)) return;
		} else if (note.visibility === 'specified') {
			if (!note.visibleUserIds!.includes(this.user!.id)) return;
		}

		if (note.reply) {
			const reply = note.reply;
			if (this.membershipsMap[note.userId]?.withReplies) {
				// 自分のフォローしていないユーザーの visibility: followers な投稿への返信は弾く
				if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId)) return;
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
				if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId)) return;
			}
		}

		if (this.isNoteMutedOrBlocked(note)) return;

		if (this.user && isRenotePacked(note) && !isQuotePacked(note)) {
			if (note.renote && Object.keys(note.renote.reactions).length > 0) {
				const myRenoteReaction = await this.noteEntityService.populateMyReaction(note.renote, this.user.id);
				note.renote.myReaction = myRenoteReaction;
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
		this.subscriber.off(`userListStream:${this.listId}`, this.send);
		this.subscriber.off('notesStream', this.onNote);

		clearInterval(this.listUsersClock);
	}
}

@Injectable()
export class UserListChannelService implements MiChannelService<false> {
	public readonly shouldShare = UserListChannel.shouldShare;
	public readonly requireCredential = UserListChannel.requireCredential;
	public readonly kind = UserListChannel.kind;

	constructor(
		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,

		@Inject(DI.userListMembershipsRepository)
		private userListMembershipsRepository: UserListMembershipsRepository,

		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): UserListChannel {
		return new UserListChannel(
			this.userListsRepository,
			this.userListMembershipsRepository,
			this.roleService,
			this.noteEntityService,
			id,
			connection,
		);
	}
}
