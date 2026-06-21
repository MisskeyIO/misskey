/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { Packed } from '@/misc/json-schema.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { CacheService } from '@/core/CacheService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { CoreModule } from '@/core/CoreModule.js';
import { DI } from '@/di-symbols.js';
import { genAidx } from '@/misc/id/aidx.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import type { UserLanguagesRepository, UsersRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';

describe('NoteEntityService', () => {
	let app: TestingModule;
	let service: NoteEntityService;
	let cacheService: CacheService;
	let usersRepository: UsersRepository;
	let userLanguagesRepository: UserLanguagesRepository;
	const userIds: MiUser['id'][] = [];
	const followingCacheUserIds: MiUser['id'][] = [];

	async function createUser(data: Partial<MiUser> = {}): Promise<MiUser> {
		const username = secureRndstr(16);
		const result = await usersRepository.insert({
			id: genAidx(Date.now()),
			username,
			usernameLower: username.toLowerCase(),
			...data,
		});
		const user = await usersRepository.findOneByOrFail(result.identifiers[0]);
		userIds.push(user.id);
		return user;
	}

	async function setUserLang(user: MiUser, viewingLangs: string[], options: {
		showMediaInAllLanguages?: boolean;
		showHashtagsInAllLanguages?: boolean;
	} = {}): Promise<void> {
		await userLanguagesRepository.insert({
			userId: user.id,
			postingLang: null,
			viewingLangs,
			showMediaInAllLanguages: options.showMediaInAllLanguages ?? false,
			showHashtagsInAllLanguages: options.showHashtagsInAllLanguages ?? false,
		});
	}

	function makePackedUser(data: Partial<Packed<'UserLite'>> = {}): Packed<'UserLite'> {
		return {
			id: 'user',
			name: null,
			username: 'user',
			host: null,
			avatarUrl: 'https://example.test/avatar.png',
			avatarBlurhash: null,
			avatarDecorations: [],
			emojis: {},
			onlineStatus: 'unknown',
			...data,
		};
	}

	function makePackedNote(data: Partial<Packed<'Note'>> = {}): Packed<'Note'> {
		return {
			id: 'note',
			createdAt: new Date().toISOString(),
			lang: 'unknown',
			userId: 'author',
			user: makePackedUser({ id: 'author', username: 'author' }),
			text: null,
			cw: null,
			visibility: 'public',
			localOnly: false,
			reactionAcceptance: null,
			reactionEmojis: {},
			reactions: {},
			reactionCount: 0,
			renoteCount: 0,
			repliesCount: 0,
			fileIds: [],
			files: [],
			replyId: null,
			replyUserId: null,
			renoteId: null,
			dimension: 0,
			...data,
		};
	}

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		await app.init();
		service = app.get(NoteEntityService);
		cacheService = app.get(CacheService);
		usersRepository = app.get(DI.usersRepository);
		userLanguagesRepository = app.get(DI.userLanguagesRepository);
	});

	afterAll(async () => {
		await app.close();
	});

	afterEach(async () => {
		if (userIds.length > 0) {
			await userLanguagesRepository.delete(userIds);
			await usersRepository.delete(userIds);
		}
		await Promise.all(followingCacheUserIds.map(id => cacheService.userFollowingsCache.delete(id)));
		userIds.length = 0;
		followingCacheUserIds.length = 0;
	});

	test('isLanguageVisibleToMe allows null viewer and owner visibility', async () => {
		const viewer = await createUser();
		await setUserLang(viewer, ['ja']);
		const note = makePackedNote({ userId: 'author', lang: 'other' });

		await expect(service.isLanguageVisibleToMe(note, null)).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(note, 'author')).resolves.toBe(true);
	});

	test('isLanguageVisibleToMe respects language preferences and regional fallbacks', async () => {
		const jaViewer = await createUser();
		const otherViewer = await createUser();
		await setUserLang(jaViewer, ['ja']);
		await setUserLang(otherViewer, ['other']);
		const note = makePackedNote({ lang: 'ja-JP' });

		await expect(service.isLanguageVisibleToMe(note, jaViewer.id)).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(note, otherViewer.id)).resolves.toBe(false);
	});

	test('isLanguageVisibleToMe allows mentions, specified notes, media, and hashtags regardless of viewing languages', async () => {
		const mentioned = await createUser();
		const specified = await createUser();
		const mediaViewer = await createUser();
		const hashtagViewer = await createUser();
		await setUserLang(mentioned, ['other']);
		await setUserLang(specified, ['other']);
		await setUserLang(mediaViewer, ['other'], { showMediaInAllLanguages: true });
		await setUserLang(hashtagViewer, ['other'], { showHashtagsInAllLanguages: true });

		await expect(service.isLanguageVisibleToMe(makePackedNote({ lang: 'ja', mentions: [mentioned.id] }), mentioned.id)).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(makePackedNote({ lang: 'ja', visibleUserIds: [specified.id] }), specified.id)).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(makePackedNote({ lang: 'ja', fileIds: ['file'] }), mediaViewer.id)).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(makePackedNote({ lang: 'ja', tags: ['misskey'] }), hashtagViewer.id)).resolves.toBe(true);
	});

	test('shouldHideNote hides sign-in only notes from anonymous viewers', async () => {
		const note = makePackedNote({
			user: makePackedUser({ requireSigninToViewContents: true }),
		});

		await expect(service.shouldHideNote(note, null)).resolves.toBe(true);
		await expect(service.shouldHideNote(note, 'signed-in-viewer')).resolves.toBe(false);
	});

	test('shouldHideNote hides notes created before the hidden-before threshold', async () => {
		const note = makePackedNote({
			createdAt: '2024-01-01T00:00:00.000Z',
			user: makePackedUser({ makeNotesHiddenBefore: 1_704_147_200 }),
		});

		await expect(service.shouldHideNote(note, 'viewer')).resolves.toBe(true);
	});

	test('treatVisibility converts public notes before the followers-only threshold', () => {
		const note = makePackedNote({
			createdAt: '2024-01-01T00:00:00.000Z',
			visibility: 'public',
			user: makePackedUser({ makeNotesFollowersOnlyBefore: 1_704_147_200 }),
		});

		expect(service['treatVisibility'](note)).toBe('followers');
		expect(note.visibility).toBe('followers');
	});

	test('shouldHideNote allows followers replies when replyUserId matches viewer without packed reply', async () => {
		const viewerId = 'viewer-reply';
		followingCacheUserIds.push(viewerId);
		await cacheService.userFollowingsCache.set(viewerId, {});

		const note = makePackedNote({
			visibility: 'followers',
			replyId: 'reply-note',
			replyUserId: viewerId,
		});

		await expect(service.shouldHideNote(note, viewerId)).resolves.toBe(false);
	});

	test('shouldHideNote allows followers notes for remote viewers when author is also remote and cache has no relation', async () => {
		const viewer = await createUser({ host: 'viewer.example' });
		followingCacheUserIds.push(viewer.id);
		await cacheService.userFollowingsCache.set(viewer.id, {});

		const note = makePackedNote({
			visibility: 'followers',
			userId: 'author-remote',
			user: makePackedUser({
				id: 'author-remote',
				username: 'authorremote',
				host: 'author.example',
			}),
		});

		await expect(service.shouldHideNote(note, viewer.id)).resolves.toBe(false);
	});
});
