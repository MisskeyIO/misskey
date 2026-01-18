/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { AdsRepository } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { FileInfoService } from '@/core/FileInfoService.js';
import { createTemp } from '@/misc/create-temp.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	kind: 'write:admin:ad',
	res: {
		type: 'object',
		optional: false,
		nullable: false,
		ref: 'Ad',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		url: { type: 'string', minLength: 1 },
		memo: { type: 'string' },
		place: { type: 'string' },
		priority: { type: 'string' },
		ratio: { type: 'integer' },
		expiresAt: { type: 'integer' },
		startsAt: { type: 'integer' },
		imageUrl: { type: 'string', minLength: 1 },
		dayOfWeek: { type: 'integer' },
		isSensitive: { type: 'boolean', default: false },
	},
	required: ['url', 'memo', 'place', 'priority', 'ratio', 'expiresAt', 'startsAt', 'imageUrl', 'dayOfWeek'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.adsRepository)
		private adsRepository: AdsRepository,

		private idService: IdService,
		private moderationLogService: ModerationLogService,
		private downloadService: DownloadService,
		private fileInfoService: FileInfoService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let imageBlurhash: string | null = null;
			if (ps.imageUrl) {
				try {
					const [tmpPath, cleanup] = await createTemp();
					try {
						await this.downloadService.downloadUrl(ps.imageUrl, tmpPath);
						const info = await this.fileInfoService.getFileInfo(tmpPath, {
							skipSensitiveDetection: true,
						});
						imageBlurhash = info.blurhash ?? null;
					} finally {
						cleanup();
					}
				} catch {
					imageBlurhash = null;
				}
			}

			const ad = await this.adsRepository.insertOne({
				id: this.idService.gen(),
				expiresAt: new Date(ps.expiresAt),
				startsAt: new Date(ps.startsAt),
				dayOfWeek: ps.dayOfWeek,
				isSensitive: ps.isSensitive,
				url: ps.url,
				imageUrl: ps.imageUrl,
				imageBlurhash,
				priority: ps.priority,
				ratio: ps.ratio,
				place: ps.place,
				memo: ps.memo,
				isSensitive: ps.isSensitive ?? false,
			});

			this.moderationLogService.log(me, 'createAd', {
				adId: ad.id,
				ad: ad,
			});

			return {
				id: ad.id,
				expiresAt: ad.expiresAt.toISOString(),
				startsAt: ad.startsAt.toISOString(),
				dayOfWeek: ad.dayOfWeek,
				isSensitive: ad.isSensitive,
				url: ad.url,
				imageUrl: ad.imageUrl,
				imageBlurhash: ad.imageBlurhash,
				priority: ad.priority,
				ratio: ad.ratio,
				place: ad.place,
				memo: ad.memo,
				isSensitive: ad.isSensitive,
			};
		});
	}
}
