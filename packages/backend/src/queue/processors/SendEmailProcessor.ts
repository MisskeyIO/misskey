/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import * as Bull from 'bullmq';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { EmailService } from '@/core/EmailService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

export type SendEmailJobData = {
	to: string;
	subject: string;
	html: string;
	text: string;
};

@Injectable()
export class SendEmailProcessorService {
	private logger: Logger;

	constructor(
		private emailService: EmailService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('send-email');
	}

	@bindThis
	public async process(job: Bull.Job<SendEmailJobData>): Promise<void> {
		this.logger.info(`Sending email to ${job.data.to}`);

		try {
			await this.emailService.sendEmail(
				job.data.to,
				job.data.subject,
				job.data.html,
				job.data.text,
			);
			this.logger.info(`Email sent successfully to ${job.data.to}`);
		} catch (error) {
			this.logger.error(`Failed to send email to ${job.data.to}: ${error}`);
			throw error;
		}
	}
}
