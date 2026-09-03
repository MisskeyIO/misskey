/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, Scope } from '@nestjs/common';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { bindThis } from '@/decorators.js';
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

		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
	) {
		super(request);
		//this.onEvent = this.onEvent.bind(this);
	}

	@bindThis
	public async init(params: JsonObject) {
		if (typeof params.antennaId !== 'string') return;
		this.antennaId = params.antennaId;
		this.minimize = !!(params.minimize ?? false);

		// Subscribe stream
		this.subscriber.on(`antennaStream:${this.antennaId}`, this.onEvent);
	}

	@bindThis
	private async onEvent(data: GlobalEvents['antenna']['payload']) {
		if (data.type === 'note') {
			const note = await this.noteEntityService.pack(data.body.id, this.user, {
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

			if (this.isNoteMutedOrBlocked(note)) return;

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
