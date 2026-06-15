/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/// <reference path="../vue-shims.d.ts" />

import { describe, test, assert, afterEach, beforeEach, expect, vi } from 'vitest';
import { render, cleanup, fireEvent, type RenderResult } from '@testing-library/vue';
import { ref } from 'vue';
import { preferReactive, preferState } from './init.js';
import type { SummalyResult } from '@misskey-dev/summaly';
import { components } from '@/components/index.js';
import { directives } from '@/directives/index.js';
import MkUrlPreview from '@/components/MkUrlPreview.vue';
import MkLink from '@/components/MkLink.vue';
import MkUrl from '@/components/global/MkUrl.vue';

const osMock = vi.hoisted(() => {
	return {
		confirm: vi.fn(async () => ({ canceled: false })),
		popup: vi.fn(() => ({ dispose: vi.fn() })),
		contextMenu: vi.fn(),
		pageWindow: vi.fn(),
	};
});

const instanceMock = vi.hoisted(() => {
	return {
		enableUrlPreview: false,
		wellKnownWebsites: ['well-known.example'],
	};
});

const routerPushByPathMock = vi.hoisted(() => vi.fn());

vi.mock('@/os.js', () => osMock);
vi.mock('@/instance.js', () => ({ instance: instanceMock }));
vi.mock('@/router.js', () => {
	return {
		useRouter: () => ({
			currentRoute: ref({ path: '/', name: null }),
			resolve: (to: string) => ({ route: { path: to, name: null } }),
			pushByPath: routerPushByPathMock,
		}),
	};
});

type PreviewSummary = Partial<Omit<SummalyResult, 'player'>> & {
	player?: Partial<SummalyResult['player']> | null;
};

describe('MkUrlPreview', () => {
	const renderPreviewBy = async (summary: PreviewSummary): Promise<RenderResult> => {
		if (!summary.player) {
			summary.player = {
				url: null,
				width: null,
				height: null,
				allow: [],
			};
		}

		fetchMock.mockOnceIf((req) => {
			const url = new URL(req.url);
			return url.pathname === '/url';
		}, () => {
			return {
				status: 200,
				body: JSON.stringify(summary),
			};
		});

		const result = render(MkUrlPreview, {
			props: { url: summary.url! },
			global: { directives, components },
		});

		await new Promise<void>(resolve => {
			const observer = new MutationObserver(() => {
				resolve();
				observer.disconnect();
			});
			observer.observe(result.container, { childList: true, subtree: true });
		});

		return result;
	};

	const renderAndOpenPreview = async (summary: PreviewSummary): Promise<HTMLIFrameElement | null> => {
		const mkUrlPreview = await renderPreviewBy(summary);
		const buttons = mkUrlPreview.getAllByRole('button');
		buttons[0].click();
		// Wait for the click event to be fired
		await Promise.resolve();

		return mkUrlPreview.container.querySelector('iframe');
	};

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		vi.spyOn(window, 'open').mockImplementation(() => null);
		osMock.confirm.mockResolvedValue({ canceled: false });
		instanceMock.wellKnownWebsites = ['well-known.example'];
		preferState.trustedExternalWebsites = ['trusted.example'];
		preferReactive.trustedExternalWebsites = ref<unknown>(['trusted.example']);
	});

	afterEach(() => {
		fetchMock.resetMocks();
		cleanup();
	});

	test('Should render the description', async () => {
		const mkUrlPreview = await renderPreviewBy({
			url: 'https://example.local',
			description: 'Mocked description',
		});
		mkUrlPreview.getByText('Mocked description');
	});

	test('Sensitive preview should keep a hidden thumbnail', async () => {
		const mkUrlPreview = await renderPreviewBy({
			url: 'https://example.local',
			title: 'Sensitive article',
			thumbnail: 'https://example.local/thumbnail.png',
			sensitive: true,
		});

		const thumbnail = mkUrlPreview.container.querySelector('[class*="thumbnail"]');
		assert.exists(thumbnail, 'sensitive thumbnail should still render');
		assert.match(thumbnail?.className.toString() ?? '', /blur|hide|sensitive/i, 'sensitive thumbnail should be visually hidden');
	});

	test('Preview card should confirm before opening an untrusted external URL', async () => {
		const url = 'https://untrusted.example/article';
		const mkUrlPreview = await renderPreviewBy({
			url,
			title: 'Untrusted article',
		});

		await fireEvent.click(mkUrlPreview.getByRole('link'));

		expect(osMock.confirm).toHaveBeenCalledOnce();
		expect(window.open).toHaveBeenCalledWith(url, '_blank', 'noopener');
	});

	test('Having a player should render a button', async () => {
		const mkUrlPreview = await renderPreviewBy({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: [],
			},
		});
		const buttons = mkUrlPreview.getAllByRole('button');
		assert.strictEqual(buttons.length, 2, 'two buttons');
	});

	test('Having a player should setup the iframe', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: [],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.src, 'https://example.local/player?autoplay=1&auto_play=1');
		assert.strictEqual(
			iframe?.sandbox.toString(),
			'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-storage-access-by-user-activation allow-same-origin',
		);
	});

	test('Having a player with `allow` field should set permissions', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: ['fullscreen', 'web-share'],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.allow, 'fullscreen;web-share');
	});

	test('A Summaly proxy response without allow falls back to the default', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.allow, 'autoplay;encrypted-media;fullscreen');
	});

	test('Filtering the allow list from the Summaly proxy', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: ['autoplay', 'camera', 'fullscreen'],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.allow, 'autoplay;fullscreen');
	});

	test('Having a player width should keep the fixed aspect ratio', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: 400,
				height: 200,
				allow: [],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.parentElement?.style.paddingTop, '50%');
	});

	test('Having a player width should keep the fixed height', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: 200,
				allow: [],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.parentElement?.style.paddingTop, '200px');
	});

	test('Loading a tweet in iframe', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://twitter.com/i/web/status/1685072521782325249',
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.getAttribute('allow'), 'fullscreen;web-share');
		assert.strictEqual(iframe?.getAttribute('sandbox'), 'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin');
	});

	test('Loading a post in iframe', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://x.com/i/web/status/1685072521782325249',
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.getAttribute('allow'), 'fullscreen;web-share');
		assert.strictEqual(iframe?.getAttribute('sandbox'), 'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin');
	});
});

describe('external link warning', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		vi.spyOn(window, 'open').mockImplementation(() => null);
		osMock.confirm.mockResolvedValue({ canceled: false });
		instanceMock.wellKnownWebsites = ['well-known.example'];
		preferState.trustedExternalWebsites = ['trusted.example'];
		preferReactive.trustedExternalWebsites = ref<unknown>(['trusted.example']);
	});

	afterEach(() => {
		cleanup();
	});

	const renderMkLink = (url: string): RenderResult => {
		return render(MkLink, {
			props: { url },
			global: { directives, components },
		});
	};

	const renderMkUrl = (url: string): RenderResult => {
		return render(MkUrl, {
			props: { url },
			global: { directives, components },
		});
	};

	test('Untrusted external URL should confirm before opening', async () => {
		const url = 'https://untrusted.example/path';
		const mkLink = renderMkLink(url);

		await fireEvent.click(mkLink.getByRole('link'));

		expect(osMock.confirm).toHaveBeenCalledOnce();
		expect(window.open).toHaveBeenCalledWith(url, '_blank', 'noopener');
	});

	test('Canceled warning should not open an untrusted external URL', async () => {
		const url = 'https://untrusted.example/path';
		osMock.confirm.mockResolvedValue({ canceled: true });
		const mkLink = renderMkLink(url);

		await fireEvent.click(mkLink.getByRole('link'));

		expect(osMock.confirm).toHaveBeenCalledOnce();
		expect(window.open).not.toHaveBeenCalled();
	});

	test('Trusted preference URL should open without warning', async () => {
		const url = 'https://trusted.example/path';
		const mkLink = renderMkLink(url);

		await fireEvent.click(mkLink.getByRole('link'));

		expect(osMock.confirm).not.toHaveBeenCalled();
		expect(window.open).toHaveBeenCalledWith(url, '_blank', 'noopener');
	});

	test('Well-known instance URL should open without warning', async () => {
		const url = 'https://well-known.example/path';
		const mkLink = renderMkLink(url);

		await fireEvent.click(mkLink.getByRole('link'));

		expect(osMock.confirm).not.toHaveBeenCalled();
		expect(window.open).toHaveBeenCalledWith(url, '_blank', 'noopener');
	});

	test('Well-known parent domain should trust subdomains without warning', async () => {
		const url = 'https://docs.example.com/path';
		instanceMock.wellKnownWebsites = ['example.com'];
		const mkLink = renderMkLink(url);

		await fireEvent.click(mkLink.getByRole('link'));

		expect(osMock.confirm).not.toHaveBeenCalled();
		expect(window.open).toHaveBeenCalledWith(url, '_blank', 'noopener');
	});

	test('Well-known regex expression should trust matching URLs without warning', async () => {
		const url = 'https://safe.example/docs/page';
		instanceMock.wellKnownWebsites = ['/safe\\.example\\/docs/'];
		const mkLink = renderMkLink(url);

		await fireEvent.click(mkLink.getByRole('link'));

		expect(osMock.confirm).not.toHaveBeenCalled();
		expect(window.open).toHaveBeenCalledWith(url, '_blank', 'noopener');
	});

	test('Local URL should route without warning', async () => {
		const localUrl = new URL('/notes/test', window.location.href).href;
		const mkUrl = renderMkUrl(localUrl);

		await fireEvent.click(mkUrl.getByRole('link'));

		expect(osMock.confirm).not.toHaveBeenCalled();
		expect(window.open).not.toHaveBeenCalled();
		expect(routerPushByPathMock).toHaveBeenCalledWith('/notes/test', null);
	});
});
