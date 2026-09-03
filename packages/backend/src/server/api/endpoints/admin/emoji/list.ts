/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { EmojisRepository } from '@/models/_.js';
import type { MiEmoji } from '@/models/Emoji.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requiredRolePolicy: 'canManageCustomEmojis',
	kind: 'read:admin:emoji',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			ref: 'EmojiDetailed',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		query: { type: 'string', nullable: true, default: null },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private emojiEntityService: EmojiEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const q = this.queryService.makePaginationQuery(this.emojisRepository.createQueryBuilder('emoji'), ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate)
				.andWhere('emoji.host IS NULL');

			let emojis: MiEmoji[];

			if (ps.query) {
				if (ps.query.startsWith(':') && ps.query.endsWith(':') && ps.query.length > 2) {
					// 登録名と完全一致の検索
					q.andWhere('emoji.name = :q', { q: ps.query.slice(1, -1) });

					emojis = await q.limit(ps.limit).getMany();
				} else {
					// 登録名、エイリアス、カテゴリーの部分一致の検索
					// TODO: クエリーで処理したいが、aliasesがarrayなので複雑になりすぎるためいったん放置
					emojis = (await q.getMany())
						.filter(emoji => emoji.name.includes(ps.query!)
							|| emoji.aliases.some(a => a.includes(ps.query!))
							|| emoji.category?.includes(ps.query!),
						)
						.slice(0, ps.limit);
				}
			} else {
				emojis = await q.limit(ps.limit).getMany();
			}

			return this.emojiEntityService.packInternalMany(emojis);
		});
	}
}
