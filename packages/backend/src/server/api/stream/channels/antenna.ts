/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { DI } from '@/di-symbols.js';
import type { AntennasRepository } from '@/models/_.js';
import { RoleService } from '@/core/RoleService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteStreamingHidingService } from '../NoteStreamingHidingService.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

class AntennaChannel extends Channel {
	public readonly chName = 'antenna';
	public static readonly shouldShare = false;
	public static readonly requireCredential = true as const;
	public static readonly kind = 'read:account';
	private antennaId: string;
	private minimize: boolean;

	constructor(
		private readonly antennasRepository: AntennasRepository,

		private readonly roleService: RoleService,
		private readonly noteEntityService: NoteEntityService,
		private readonly noteStreamingHidingService: NoteStreamingHidingService,
		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection, null);
		//this.onEvent = this.onEvent.bind(this);
	}

	@bindThis
	public async init(params: JsonObject): Promise<boolean> {
		if (typeof params.antennaId !== 'string') return false;
		if (!this.user) return false;

		this.antennaId = params.antennaId;
		this.minimize = !!(params.minimize ?? false);

		const antennaExists = await this.antennasRepository.exists({
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
			const note = await this.noteEntityService.pack(data.body.id, this.user, {
				detail: true,
				skipLanguageCheck: true,
				viewerDimension: null,
			});

			if (note.reply) {
				const reply = note.reply;
				if (!this.isNoteVisibleForMe(reply)) return;
			}

			if (!(await this.noteEntityService.isLanguageVisibleToMe(note, this.user?.id))) return;

			if (!this.isNoteVisibleForMe(note)) return;
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
		this.subscriber.off(`antennaStream:${this.antennaId}`, this.onEvent);
	}
}

@Injectable()
export class AntennaChannelService implements MiChannelService<true> {
	public readonly shouldShare = AntennaChannel.shouldShare;
	public readonly requireCredential = AntennaChannel.requireCredential;
	public readonly kind = AntennaChannel.kind;

	constructor(
		@Inject(DI.antennasRepository)
		private readonly antennasRepository: AntennasRepository,

		private readonly roleService: RoleService,
		private readonly noteEntityService: NoteEntityService,
		private readonly noteStreamingHidingService: NoteStreamingHidingService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection'], dimension?: number | null): AntennaChannel {
		return new AntennaChannel(
			this.antennasRepository,
			this.roleService,
			this.noteEntityService,
			this.noteStreamingHidingService,
			id,
			connection,
		);
	}
}
