/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { DI } from '@/di-symbols.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { UrlPreviewService } from '@/server/web/UrlPreviewService.js';
import type { TestingModule } from '@nestjs/testing';

describe('UrlPreviewService', () => {
	let app: TestingModule;
	let fastify: FastifyInstance;
	let getJson: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		getJson = vi.fn();
		const logger = {
			info: vi.fn(),
			succ: vi.fn(),
			warn: vi.fn(),
		};

		app = await Test.createTestingModule({
			providers: [
				UrlPreviewService,
				{
					provide: DI.config,
					useValue: {
						mediaProxy: 'https://media-proxy.example',
					},
				},
				{
					provide: DI.meta,
					useValue: {
						urlPreviewEnabled: true,
						urlPreviewSummaryProxyUrl: 'https://summary-proxy.example/summary',
						urlPreviewAllowRedirect: false,
						urlPreviewUserAgent: null,
						urlPreviewTimeout: 10000,
						urlPreviewMaximumContentLength: 1024 * 1024,
						urlPreviewRequireContentLength: false,
						urlPreviewDenyList: ['blocked.example'],
					},
				},
				{
					provide: HttpRequestService,
					useValue: {
						getJson,
					},
				},
				{
					provide: LoggerService,
					useValue: {
						getLogger: () => logger,
					},
				},
			],
		}).compile();

		const urlPreviewService = app.get(UrlPreviewService);
		fastify = Fastify();
		fastify.get<{ Querystring: { url: string; lang?: string; } }>('/url', (request, reply) => urlPreviewService.handle(request, reply));
		await fastify.ready();
	});

	afterEach(async () => {
		await fastify.close();
		await app.close();
	});

	test('marks urlPreviewDenyList matches as sensitive', async () => {
		getJson.mockResolvedValue({
			title: 'Blocked preview',
			icon: null,
			thumbnail: null,
			description: null,
			sitename: null,
			url: 'https://blocked.example/posts/1',
			sensitive: false,
			player: {
				url: null,
			},
		});

		const res = await fastify.inject({
			method: 'GET',
			url: '/url?url=https%3A%2F%2Fsource.example%2Fposts%2F1',
		});
		const body = res.json<{ sensitive: boolean; }>();

		expect(res.statusCode).toBe(200);
		expect(body.sensitive).toBe(true);
	});
});
