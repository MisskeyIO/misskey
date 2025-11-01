/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { assert, describe, test } from 'vitest';
import { onScrollBottom, onScrollTop } from '@@/js/scroll.js';

describe('Scroll', () => {
	describe('onScrollTop', () => {
		// XXX: 環境依存のためskip
		test.skip('Initial onScrollTop callback for connected elements', () => {
			const div = document.createElement('div');
			assert.strictEqual(div.scrollTop, 0);

			document.body.append(div);

			let called = false;
			onScrollTop(div as any as HTMLElement, () => called = true);

			assert.ok(called);
		});

		test('No onScrollTop callback for disconnected elements', () => {
			const div = document.createElement('div');
			assert.strictEqual(div.scrollTop, 0);

			let called = false;
			onScrollTop(div as any as HTMLElement, () => called = true);

			assert.ok(!called);
		});
	});

	describe('onScrollBottom', () => {
		// XXX: 環境依存のためskip
		test.skip('Initial onScrollBottom callback for connected elements', () => {
			const div = document.createElement('div');
			assert.strictEqual(div.scrollTop, 0);

			document.body.append(div);

			let called = false;
			onScrollBottom(div as any as HTMLElement, () => called = true);

			assert.ok(called);
		});

		test('No onScrollBottom callback for disconnected elements', () => {
			const div = document.createElement('div');
			assert.strictEqual(div.scrollTop, 0);

			let called = false;
			onScrollBottom(div as any as HTMLElement, () => called = true);

			assert.ok(!called);
		});
	});
});
