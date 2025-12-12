import { Inject, Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { DI } from '@/di-symbols.js';
import type Logger from '@/logger.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import type { MiMeta } from '@/models/Meta.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbCleanBlockedRemoteCustomEmojis } from '../types.js';

@Injectable()
export class CleanBlockedRemoteCustomEmojisProcessorService {
	private logger: Logger;

	constructor(
		private customEmojiService: CustomEmojiService,
		private queueLoggerService: QueueLoggerService,
		@Inject(DI.meta)
		private meta: MiMeta,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('clean-blocked-remote-custom-emojis');
	}

	@bindThis
	public async process(job: Bull.Job<DbCleanBlockedRemoteCustomEmojis>): Promise<void> {
		const blockedRemoteCustomEmojis = job.data?.blockedRemoteCustomEmojis ?? this.meta.blockedRemoteCustomEmojis ?? [];

		this.logger.info(`Removing blocked remote custom emojis (count=${blockedRemoteCustomEmojis.length})`);

		await this.customEmojiService.removeBlockedRemoteCustomEmojis(blockedRemoteCustomEmojis);

		this.logger.succ('Finished removing blocked remote custom emojis');
	}
}
