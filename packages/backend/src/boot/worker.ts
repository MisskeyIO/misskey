/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import cluster from 'node:cluster';
import { envOption } from '@/env.js';
import { loadConfig } from '@/config.js';
import { initExtraThreadPool, jobQueue, server } from './common.js';

/**
 * Init worker process
 */
export async function workerMain() {
	const config = loadConfig();

	initExtraThreadPool(config);

	if (config.sentryForBackend) {
		const Sentry = await import('@sentry/node');
		const { nodeProfilingIntegration } = await import('@sentry/profiling-node');

		Sentry.init({
			release: config.version,
			integrations: [
				...(config.sentryForBackend.enableNodeProfiling ? [nodeProfilingIntegration()] : []),
			],

			tracesSampleRate: 1,
			profileSessionSampleRate: 1,
			maxBreadcrumbs: 0,

			...config.sentryForBackend.options,
		});
	}

	if (envOption.onlyServer) {
		await server();
	} else if (envOption.onlyQueue) {
		await jobQueue();
	} else {
		await jobQueue();
	}

	if (cluster.isWorker) {
		// Send a 'ready' message to parent process
		process.send!('ready');
	}
}
