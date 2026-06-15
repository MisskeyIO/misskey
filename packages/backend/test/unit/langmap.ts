/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'assert';
import { describe, test } from 'vitest';

import { isNoteLanguageVisible, postingLangCodes, resolveNoteLang } from '@/misc/langmap.js';

describe('resolveNoteLang', () => {
	test('uses explicit note language first', () => {
		assert.strictEqual(resolveNoteLang('ja', false), 'ja');
		assert.strictEqual(resolveNoteLang('en-US', true), 'en-US');
	});

	test('falls back to remote or unknown when note language is missing', () => {
		assert.strictEqual(resolveNoteLang(null, true), 'remote');
		assert.strictEqual(resolveNoteLang(undefined, false), 'unknown');
	});
});

describe('isNoteLanguageVisible', () => {
	const baseParams = {
		noteLang: 'ja',
		isRemote: false,
		hasMedia: false,
		hasTags: false,
	};

	test('allows all languages when preference is missing or empty', () => {
		assert.strictEqual(isNoteLanguageVisible(baseParams, null), true);
		assert.strictEqual(isNoteLanguageVisible(baseParams, {
			viewingLangs: [],
			showMediaInAllLanguages: false,
			showHashtagsInAllLanguages: false,
		}), true);
	});

	test('matches explicit viewing languages', () => {
		assert.strictEqual(isNoteLanguageVisible(baseParams, {
			viewingLangs: ['ja'],
			showMediaInAllLanguages: false,
			showHashtagsInAllLanguages: false,
		}), true);
		assert.strictEqual(isNoteLanguageVisible(baseParams, {
			viewingLangs: ['other'],
			showMediaInAllLanguages: false,
			showHashtagsInAllLanguages: false,
		}), false);
	});

	test('accepts other as a posting language', () => {
		assert.ok(postingLangCodes.includes('other'));
	});

	test('remote viewing marker allows remote notes regardless of note language', () => {
		assert.strictEqual(isNoteLanguageVisible({ ...baseParams, isRemote: true, noteLang: 'ja' }, {
			viewingLangs: ['remote'],
			showMediaInAllLanguages: false,
			showHashtagsInAllLanguages: false,
		}), true);
	});

	test('requires unknown for local notes without language', () => {
		assert.strictEqual(isNoteLanguageVisible({ ...baseParams, noteLang: null }, {
			viewingLangs: ['other'],
			showMediaInAllLanguages: false,
			showHashtagsInAllLanguages: false,
		}), false);
		assert.strictEqual(isNoteLanguageVisible({ ...baseParams, noteLang: null }, {
			viewingLangs: ['unknown'],
			showMediaInAllLanguages: false,
			showHashtagsInAllLanguages: false,
		}), true);
	});

	test('allows media or hashtag notes when override flags are enabled', () => {
		assert.strictEqual(isNoteLanguageVisible({ ...baseParams, hasMedia: true }, {
			viewingLangs: ['other'],
			showMediaInAllLanguages: true,
			showHashtagsInAllLanguages: false,
		}), true);
		assert.strictEqual(isNoteLanguageVisible({ ...baseParams, hasTags: true }, {
			viewingLangs: ['other'],
			showMediaInAllLanguages: false,
			showHashtagsInAllLanguages: true,
		}), true);
	});
});
