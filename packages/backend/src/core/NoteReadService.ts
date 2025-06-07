/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { setTimeout } from 'node:timers/promises';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiUser } from '@/models/User.js';
import type { Packed } from '@/misc/json-schema.js';
import type { MiNote } from '@/models/Note.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import type { MutingsRepository, NoteThreadMutingsRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { trackPromise } from '@/misc/promise-tracker.js';

@Injectable()
export class NoteReadService implements OnApplicationShutdown {
	#shutdownController = new AbortController();

	constructor(
		@Inject(DI.mutingsRepository)
		private mutingsRepository: MutingsRepository,

		@Inject(DI.noteThreadMutingsRepository)
		private noteThreadMutingsRepository: NoteThreadMutingsRepository,

		private idService: IdService,
		private globalEventService: GlobalEventService,
	) {
	}

	@bindThis
	public async insertNoteUnread(userId: MiUser['id'], note: MiNote, params: {
		// NOTE: isSpecifiedがtrueならisMentionedは必ずfalse
		isSpecified: boolean;
		isMentioned: boolean;
	}): Promise<void> {
		//#region ミュートしているなら無視
		const mute = await this.mutingsRepository.findBy({
			muterId: userId,
		});
		if (mute.map(m => m.muteeId).includes(note.userId)) return;
		//#endregion

		// スレッドミュート
		const isThreadMuted = await this.noteThreadMutingsRepository.exists({
			where: {
				userId: userId,
				threadId: note.threadId ?? note.id,
			},
		});
		if (isThreadMuted) return;

		// 2秒経っても既読にならなかったら「未読の投稿がありますよ」イベントを発行する
		setTimeout(2000, 'unread note', { signal: this.#shutdownController.signal }).then(async () => {
			if (params.isMentioned) {
				this.globalEventService.publishMainStream(userId, 'notification', note.id);
			}
			if (params.isSpecified) {
				this.globalEventService.publishMainStream(userId, 'notification', note.id);
			}
		}, () => { /* aborted, ignore it */ });
	}

	@bindThis
	public async read(
		userId: MiUser['id'],
		notes: (MiNote | Packed<'Note'>)[],
	): Promise<void> {
		if (notes.length === 0) return;

		const noteIds = new Set<MiNote['id']>(
			notes.filter(note =>
				(note.mentions?.includes(userId) ?? false) || (note.visibleUserIds?.includes(userId) ?? false),
			).map(note => note.id),
		);

		if (noteIds.size === 0) return;

		// TODO: ↓まとめてクエリしたい
		trackPromise(Promise.resolve(0).then((mentionsCount: number) => {
			if (mentionsCount === 0) {
				// 全て既読になったイベントを発行
				this.globalEventService.publishMainStream(userId, 'notification');
			}
		}));

		trackPromise(Promise.resolve(0).then((specifiedCount: number) => {
			if (specifiedCount === 0) {
				// 全て既読になったイベントを発行
				this.globalEventService.publishMainStream(userId, 'notification');
			}
		}));
	}

	@bindThis
	public dispose(): void {
		this.#shutdownController.abort();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
