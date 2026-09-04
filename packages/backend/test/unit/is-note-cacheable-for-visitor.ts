import { describe, expect, test } from 'vitest';
import { isNoteCacheableForVisitor } from '@/misc/is-note-cacheable-for-visitor.js';
import type { Packed } from '@/misc/json-schema.js';

function note(overrides: Record<string, unknown> = {}): Packed<'Note'> {
	return {
		id: 'note',
		createdAt: '2026-09-02T00:00:00.000Z',
		visibility: 'public',
		channelId: undefined,
		isHidden: false,
		user: {
			host: null,
			requireSigninToViewContents: false,
			makeNotesHiddenBefore: null,
		},
		...overrides,
	} as unknown as Packed<'Note'>;
}

describe(isNoteCacheableForVisitor, () => {
	test.each([
		['public', 'public'],
		['home', 'home'],
	])('%s投稿を許可する', (_label, visibility) => {
		expect(isNoteCacheableForVisitor(note({ visibility }), 'all')).toBe(true);
	});

	test.each([
		['followers', 'followers'],
		['specified', 'specified'],
	])('%s投稿を拒否する', (_label, visibility) => {
		expect(isNoteCacheableForVisitor(note({ visibility }), 'all')).toBe(false);
	});

	test('次元の値にかかわらずpublic投稿を許可する', () => {
		expect(isNoteCacheableForVisitor(note({ dimension: 1000 }), 'all')).toBe(true);
	});

	test('チャンネルのpublic投稿を許可する', () => {
		expect(isNoteCacheableForVisitor(note({ channelId: 'channel' }), 'all')).toBe(true);
	});

	test('ログイン必須投稿を拒否する', () => {
		expect(isNoteCacheableForVisitor(note({
			user: {
				host: null,
				requireSigninToViewContents: true,
				makeNotesHiddenBefore: null,
			},
		}), 'all')).toBe(false);
	});

	test('非表示化された投稿を拒否する', () => {
		expect(isNoteCacheableForVisitor(note({ isHidden: true }), 'all')).toBe(false);
	});

	test('期限により非表示となる投稿を拒否する', () => {
		expect(isNoteCacheableForVisitor(note({
			user: {
				host: null,
				requireSigninToViewContents: false,
				makeNotesHiddenBefore: 4102444800,
			},
		}), 'all')).toBe(false);
	});

	test('visitor向けUGC非公開設定を守る', () => {
		expect(isNoteCacheableForVisitor(note(), 'none')).toBe(false);
		expect(isNoteCacheableForVisitor(note(), undefined as never)).toBe(false);
		expect(isNoteCacheableForVisitor(note({
			user: {
				host: 'remote.example',
				requireSigninToViewContents: false,
				makeNotesHiddenBefore: null,
			},
		}), 'local')).toBe(false);
	});

	test.each(['reply', 'renote'] as const)('%sに非公開投稿を含む場合は拒否する', (key) => {
		expect(isNoteCacheableForVisitor(note({
			[key]: note({ visibility: 'specified' }),
		}), 'all')).toBe(false);
	});
});
