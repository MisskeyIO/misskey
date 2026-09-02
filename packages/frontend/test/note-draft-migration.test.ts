/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { legacyNoteDraftToRequest, parseLegacyNoteDrafts, removeUnchangedLegacyNoteDraft, scheduledNoteToDraftRequest } from '@/utility/note-draft-migration.js';

describe('note draft migration', () => {
	test('壊れた保存データを削除対象にしない', () => {
		expect(parseLegacyNoteDrafts('{')).toEqual({ entries: [], invalidCount: 0, parseFailed: true });
		expect(parseLegacyNoteDrafts(JSON.stringify({ broken: null }))).toMatchObject({ entries: [], invalidCount: 1, parseFailed: false });
	});

	test('移行中に更新された下書きを端末から消さない', () => {
		const original = { data: { text: 'before' } };
		const fingerprint = JSON.stringify(original);
		expect(removeUnchangedLegacyNoteDraft(JSON.stringify({ key: { data: { text: 'after' } } }), 'key', fingerprint)).toBeNull();
		expect(removeUnchangedLegacyNoteDraft(JSON.stringify({ key: original, other: original }), 'key', fingerprint)).toBe(JSON.stringify({ other: original }));
	});

	test('端末内下書きのio投稿設定と引用を保つ', () => {
		const stored = {
			updatedAt: '2025-07-01T00:00:00.000Z',
			scheduledAt: '2099-07-02T00:00:00.000Z',
			data: {
				text: 'draft',
				useCw: false,
				cw: 'hidden',
				visibility: 'home',
				localOnly: false,
				dimension: 1000,
				lang: 'ja',
				files: [],
				poll: { choices: ['a', 'b'], multiple: false, expiresAt: null, expiredAfter: 60_000 },
				visibleUserIds: [],
				quoteId: 'quote',
				reactionAcceptance: 'likeOnly',
			},
		} as unknown as Parameters<typeof legacyNoteDraftToRequest>[0];

		expect(legacyNoteDraftToRequest(stored)).toMatchObject({
			cw: null,
			dimension: 1000,
			lang: 'ja',
			localOnly: true,
			renoteId: 'quote',
			scheduledAt: Date.parse('2099-07-02T00:00:00.000Z'),
			poll: { expiredAfter: 60_000 },
			reactionAcceptance: 'likeOnly',
		});
	});

	test('予約解除では時刻だけを外す', () => {
		const scheduled = {
			id: 'scheduled',
			updatedAt: '2025-07-01T00:00:00.000Z',
			scheduledAt: '2025-07-02T00:00:00.000Z',
			data: {
				text: 'draft',
				useCw: true,
				cw: 'cw',
				visibility: 'public',
				localOnly: false,
				dimension: 0,
				lang: 'ja',
				files: [],
				poll: null,
				visibleUserIds: [],
				reactionAcceptance: 'nonSensitiveOnly',
			},
		} as unknown as Parameters<typeof scheduledNoteToDraftRequest>[0];

		expect(scheduledNoteToDraftRequest(scheduled)).toMatchObject({
			scheduledAt: null,
			dimension: 0,
			lang: 'ja',
			reactionAcceptance: 'nonSensitiveOnly',
		});
	});
});
