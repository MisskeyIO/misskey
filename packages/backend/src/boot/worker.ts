/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import cluster from 'node:cluster';
import fs from 'node:fs';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { envOption } from '@/env.js';
import { loadConfig } from '@/config.js';
import { jobQueue, server } from './common.js';

const meta = JSON.parse(fs.readFileSync(`${_dirname}/../../../../built/meta.json`, 'utf-8'));

/**
 * Init worker process
 */
export async function workerMain() {
	const config = loadConfig();

	if (config.sentryForBackend) {
		Sentry.init({
			release: meta.version,
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
