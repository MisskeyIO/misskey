import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type Logger from '@/logger.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbCleanBlockedRemoteCustomEmojis } from '../types.js';

@Injectable()
export class CleanBlockedRemoteCustomEmojisProcessorService {
	private logger: Logger;

	constructor(
		private customEmojiService: CustomEmojiService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('emojis:clean:blocked-remote');
	}

	@bindThis
	public async process(job: Bull.Job<DbCleanBlockedRemoteCustomEmojis>): Promise<void> {
		const blockedRemoteCustomEmojis = job.data.blockedRemoteCustomEmojis ?? [];

		this.logger.info(`Removing blocked remote custom emojis (count=${blockedRemoteCustomEmojis.length})`);

		await this.customEmojiService.removeBlockedRemoteCustomEmojis(blockedRemoteCustomEmojis);

		this.logger.succ('Finished removing blocked remote custom emojis');
	}
}
