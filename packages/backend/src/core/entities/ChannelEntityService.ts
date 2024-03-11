/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { ChannelFavoritesRepository, ChannelFollowingsRepository, ChannelsRepository, DriveFilesRepository, NotesRepository } from '@/models/_.js';
import type { Packed } from '@/misc/json-schema.js';
import type { Config } from '@/config.js';
import type { MiUser } from '@/models/User.js';
import type { MiChannel } from '@/models/Channel.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { cacheFetch, cacheFetchOrFail } from '@/misc/cache-fetch.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import { NoteEntityService } from './NoteEntityService.js';

@Injectable()
export class ChannelEntityService {
	private readonly channelCache: LRUCache<string, MiChannel>;
	private readonly bannerCache: LRUCache<string, MiDriveFile>;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.channelFollowingsRepository)
		private channelFollowingsRepository: ChannelFollowingsRepository,

		@Inject(DI.channelFavoritesRepository)
		private channelFavoritesRepository: ChannelFavoritesRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private noteEntityService: NoteEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private idService: IdService,
	) {
		this.channelCache = new LRUCache({
			max: this.config.memoryCache.channel.max ?? 1,
			ttl: this.config.memoryCache.channel.ttl ?? 100,

			ignoreFetchAbort: true,
			ttlResolution: 1000 * 30,
			fetchMethod: async (id: string) => {
				return await this.channelsRepository.findOneByOrFail({ id });
			},
		});

		this.bannerCache = new LRUCache({
			max: this.config.memoryCache.driveFile.max ?? 1,
			ttl: this.config.memoryCache.driveFile.ttl ?? 100,

			ignoreFetchAbort: true,
			ttlResolution: 1000 * 30,
			fetchMethod: async (id: string) => {
				return await this.driveFilesRepository.findOneByOrFail({ id });
			},
		});
	}

	@bindThis
	public async pack(
		src: MiChannel['id'] | MiChannel,
		me: { id: MiUser['id'] } | null | undefined,
		detailed?: boolean,
	): Promise<Packed<'Channel'>> {
		const channel = typeof src === 'object' ? src : await cacheFetchOrFail(this.channelCache, src);
		const banner = channel.bannerId ? await cacheFetch(this.bannerCache, channel.bannerId) : null;

		const meId = me ? me.id : null;
		const isFollowing = meId ? await this.channelFollowingsRepository.exists({
			where: {
				followerId: meId,
				followeeId: channel.id,
			},
		}) : false;

		const isFavorited = meId ? await this.channelFavoritesRepository.exists({
			where: {
				userId: meId,
				channelId: channel.id,
			},
		}) : false;

		const pinnedNotes = channel.pinnedNoteIds.length > 0 ? await this.notesRepository.find({
			where: {
				id: In(channel.pinnedNoteIds),
			},
		}) : [];

		return {
			id: channel.id,
			createdAt: this.idService.parse(channel.id).date.toISOString(),
			lastNotedAt: channel.lastNotedAt ? channel.lastNotedAt.toISOString() : null,
			name: channel.name,
			description: channel.description,
			userId: channel.userId,
			bannerUrl: banner ? this.driveFileEntityService.getPublicUrl(banner) : null,
			pinnedNoteIds: channel.pinnedNoteIds,
			color: channel.color,
			isArchived: channel.isArchived,
			usersCount: channel.usersCount,
			notesCount: channel.notesCount,
			isSensitive: channel.isSensitive,
			allowRenoteToExternal: channel.allowRenoteToExternal,

			...(me ? {
				isFollowing,
				isFavorited,
				hasUnreadNote: false, // 後方互換性のため
			} : {}),

			...(detailed ? {
				pinnedNotes: (await this.noteEntityService.packMany(pinnedNotes, me)).sort((a, b) => channel.pinnedNoteIds.indexOf(a.id) - channel.pinnedNoteIds.indexOf(b.id)),
			} : {}),
		};
	}

	public async packMany(
		channels: (MiChannel['id'] | MiChannel)[],
		me: { id: MiUser['id'] } | null | undefined,
		detailed?: boolean,
	): Promise<Packed<'Channel'>[]> {
		return (await Promise.allSettled(channels.map(x => this.pack(x, me, detailed))))
			.filter(result => result.status === 'fulfilled')
			.map(result => (result as PromiseFulfilledResult<Packed<'Channel'>>).value);
	}
}
