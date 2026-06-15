/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import type Logger from '@/logger.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { bindThis } from '@/decorators.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class CleanBlockedRemoteCustomEmojisProcessorService {
	private logger: Logger;

	constructor(
		private customEmojiService: CustomEmojiService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('clean-blocked-remote-custom-emojis');
	}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>): Promise<void> {
		this.logger.info('Deleting blocked remote custom emojis...');
		const blockedRemoteCustomEmojis = job.data.blockedRemoteCustomEmojis;
		if (!Array.isArray(blockedRemoteCustomEmojis) || blockedRemoteCustomEmojis.some(x => typeof x !== 'string')) {
			throw new Error('Invalid cleanBlockedRemoteCustomEmojis job data');
		}
		await this.customEmojiService.removeBlockedRemoteCustomEmojis(blockedRemoteCustomEmojis);
		this.logger.succ('Blocked remote custom emojis have been deleted.');
	}
}
