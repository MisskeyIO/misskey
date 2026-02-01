/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Module } from '@nestjs/common';
import { CoreModule } from '@/core/CoreModule.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueStatsService } from './QueueStatsService.js';

@Module({
	imports: [
		GlobalModule,
		CoreModule,
	],
	providers: [
		QueueStatsService,
	],
	exports: [
		QueueStatsService,
	],
})
export class DaemonModule {}
