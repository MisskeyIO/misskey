/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, Scope } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { AntennasRepository } from '@/models/_.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { NoteStreamingHidingService } from '../NoteStreamingHidingService.js';
import { bindThis } from '@/decorators.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type ChannelRequest } from '../channel.js';
import { REQUEST } from '@nestjs/core';

@Injectable({ scope: Scope.TRANSIENT })
export class AntennaChannel extends Channel {
	public readonly chName = 'antenna';
	public static shouldShare = false;
	public static requireCredential = true as const;
	public static kind = 'read:account';
	private antennaId: string;
	private minimize: boolean;

	constructor(
		@Inject(REQUEST)
		request: ChannelRequest,

		@Inject(DI.antennasRepository)
		private antennasReposiotry: AntennasRepository,

		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
		private noteStreamingHidingService: NoteStreamingHidingService,
	) {
		super(request);
		//this.onEvent = this.onEvent.bind(this);
	}

	@bindThis
	public async init(params: JsonObject): Promise<boolean> {
		if (typeof params.antennaId !== 'string') return false;
		if (!this.user) return false;

		this.antennaId = params.antennaId;
		this.minimize = !!(params.minimize ?? false);

		const antennaExists = await this.antennasReposiotry.exists({
			where: {
				id: this.antennaId,
				userId: this.user.id,
			},
		});

		if (!antennaExists) return false;

		// Subscribe stream
		this.subscriber.on(`antennaStream:${this.antennaId}`, this.onEvent);

		return true;
	}

	@bindThis
	private async onEvent(data: GlobalEvents['antenna']['payload']) {
		if (data.type === 'note') {
			let note = await this.noteEntityService.pack(data.body.id, this.user, {
				detail: true,
				skipLanguageCheck: true,
				viewerDimension: null,
			});

			if (note.reply) {
				const reply = note.reply;
				if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId)) return;
				if (reply.visibility === 'specified' && !reply.visibleUserIds!.includes(this.user!.id)) return;
			}

			if (!(await this.noteEntityService.isLanguageVisibleToMe(note, this.user?.id))) return;

			if (!this.isNoteVisibleForMe(note)) return;
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
		this.subscriber.off(`antennaStream:${this.antennaId}`, this.onEvent);
	}
}
