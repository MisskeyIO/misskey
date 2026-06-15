/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'assert';
import { describe, test } from 'vitest';
import { isHttpUrl, omitHttps, query } from '@/misc/prelude/url.js';

describe('url', () => {
	test('query', () => {
		const s = query({
			foo: 'ふぅ',
			bar: 'b a r',
			baz: undefined,
		});
		assert.deepStrictEqual(s, 'foo=%E3%81%B5%E3%81%85&bar=b%20a%20r');
	});

	test('omitHttps', () => {
		assert.strictEqual(omitHttps('https://example.com/path'), 'example.com/path');
		assert.strictEqual(omitHttps('https%3A%2F%2Fexample.com%2Fpath'), 'example.com%2Fpath');
		assert.strictEqual(omitHttps('http://example.com/path'), 'http://example.com/path');
		assert.strictEqual(omitHttps('example.com/path'), 'example.com/path');
	});

	test('isHttpUrl', () => {
		assert.strictEqual(isHttpUrl('https://example.com/path'), true);
		assert.strictEqual(isHttpUrl('http://example.com/path'), true);
		assert.strictEqual(isHttpUrl('HTTPS://example.com/path'), true);

		assert.strictEqual(isHttpUrl('javascript:alert(1)'), false);
		assert.strictEqual(isHttpUrl('data:text/html,hello'), false);
		assert.strictEqual(isHttpUrl('ftp://example.com/file'), false);
		assert.strictEqual(isHttpUrl('//example.com/path'), false);
		assert.strictEqual(isHttpUrl('/relative/path'), false);
		assert.strictEqual(isHttpUrl('example.com/path'), false);
	});
});
