/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { AdsRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { ApiError } from '../../../error.js';
import { DownloadService } from '@/core/DownloadService.js';
import { FileInfoService } from '@/core/FileInfoService.js';
import { createTemp } from '@/misc/create-temp.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	kind: 'write:admin:ad',

	errors: {
		noSuchAd: {
			message: 'No such ad.',
			code: 'NO_SUCH_AD',
			id: 'b7aa1727-1354-47bc-a182-3a9c3973d300',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', format: 'misskey:id' },
		memo: { type: 'string' },
		url: { type: 'string', minLength: 1 },
		imageUrl: { type: 'string', minLength: 1 },
		place: { type: 'string' },
		priority: { type: 'string' },
		ratio: { type: 'integer' },
		expiresAt: { type: 'integer' },
		startsAt: { type: 'integer' },
		dayOfWeek: { type: 'integer' },
		isSensitive: { type: 'boolean' },
	},
	required: ['id'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.adsRepository)
		private adsRepository: AdsRepository,

		private moderationLogService: ModerationLogService,
		private downloadService: DownloadService,
		private fileInfoService: FileInfoService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const ad = await this.adsRepository.findOneBy({ id: ps.id });

			if (ad == null) throw new ApiError(meta.errors.noSuchAd);

			let imageBlurhash: string | null | undefined = undefined;
			if (ps.imageUrl != null) {
				imageBlurhash = null;
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

			await this.adsRepository.update(ad.id, {
				url: ps.url,
				place: ps.place,
				priority: ps.priority,
				ratio: ps.ratio,
				memo: ps.memo,
				imageUrl: ps.imageUrl,
				imageBlurhash,
				expiresAt: ps.expiresAt ? new Date(ps.expiresAt) : undefined,
				startsAt: ps.startsAt ? new Date(ps.startsAt) : undefined,
				dayOfWeek: ps.dayOfWeek,
				isSensitive: ps.isSensitive,
			});

			const updatedAd = await this.adsRepository.findOneByOrFail({ id: ad.id });

			this.moderationLogService.log(me, 'updateAd', {
				adId: ad.id,
				before: ad,
				after: updatedAd,
			});
		});
	}
}
