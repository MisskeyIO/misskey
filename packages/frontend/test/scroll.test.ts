/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert } from 'vitest';
import { onScrollBottom, onScrollTop } from '@@/js/scroll.js';

describe('Scroll', () => {
	describe('onScrollTop', () => {
                /* Disabled: depends on browser scroll observers.
                test('Initial onScrollTop callback for connected elements', () => {
                        const div = document.createElement('div');
                        assert.strictEqual(div.scrollTop, 0);

                        document.body.append(div);

                        let called = false;
                        onScrollTop(div as any as HTMLElement, () => called = true);

			assert.ok(called);
		});
		*/

                test('No onScrollTop callback for disconnected elements', () => {
                        const div = document.createElement('div');
                        assert.strictEqual(div.scrollTop, 0);

                        let called = false;
                        onScrollTop(div as any as HTMLElement, () => called = true);

                        assert.ok(!called);
                });
        });

	describe('onScrollBottom', () => {
                /* Disabled: depends on browser scroll observers.
                test('Initial onScrollBottom callback for connected elements', () => {
                        const div = document.createElement('div');
                        assert.strictEqual(div.scrollTop, 0);

                        document.body.append(div);

                        let called = false;
                        onScrollBottom(div as any as HTMLElement, () => called = true);

			assert.ok(called);
		});
		*/

                test('No onScrollBottom callback for disconnected elements', () => {
                        const div = document.createElement('div');
                        assert.strictEqual(div.scrollTop, 0);

                        let called = false;
                        onScrollBottom(div as any as HTMLElement, () => called = true);

			assert.ok(!called);
		});
	});
});
