import { Test, TestingModule } from '@nestjs/testing';
import type { Packed } from '@/misc/json-schema.js';
import type { MiNote } from '@/models/Note.js';
import type { MiUserLanguage } from '@/models/UserLanguage.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { CacheService } from '@/core/CacheService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { CoreModule } from '@/core/CoreModule.js';
import { DI } from '@/di-symbols.js';
import type { UsersRepository } from '@/models/_.js';

process.env.NODE_ENV = 'test';

describe('NoteEntityService', () => {
	let app: TestingModule;
	let service: NoteEntityService;
	let cacheService: CacheService;
	let usersRepository: UsersRepository;
	const userIds: string[] = [];
	const noteIds: string[] = [];
	const followingCacheUserIds: string[] = [];
	const createdUserIds: string[] = [];

	function makePackedUser(data: Partial<Packed<'UserLite'>> = {}): Packed<'UserLite'> {
		return {
			id: 'user',
			name: null,
			username: 'user',
			host: null,
			avatarUrl: null,
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
			mentions: undefined,
			visibleUserIds: undefined,
			...data,
		};
	}

	function makeNote(data: Partial<MiNote>): MiNote {
		return {
			id: 'note',
			userId: 'user',
			userHost: null,
			user: null,
			...data,
		} as MiNote;
	}

	async function setUserLang(
		userId: string,
		postingLang: string | null,
		viewingLangs: string[],
		options: {
			showMediaInAllLanguages?: boolean;
			showHashtagsInAllLanguages?: boolean;
		} = {},
	) {
		userIds.push(userId);
		const entry: MiUserLanguage = {
			userId,
			user: null,
			postingLang,
			viewingLangs,
			showMediaInAllLanguages: options.showMediaInAllLanguages ?? false,
			showHashtagsInAllLanguages: options.showHashtagsInAllLanguages ?? false,
			updatedAt: new Date(),
		};
		await cacheService.userLanguageCache.set(userId, entry);
	}

	async function setNoteLang(noteId: string, lang: string) {
		noteIds.push(noteId);
		await cacheService.noteLanguageCache.set(noteId, lang);
	}

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		await app.init();
		service = app.get(NoteEntityService);
		cacheService = app.get(CacheService);
		usersRepository = app.get(DI.usersRepository);
	});

	afterAll(async () => {
		await app.close();
	});

	afterEach(async () => {
		await Promise.all([
			...noteIds.map(id => cacheService.noteLanguageCache.delete(id)),
			...userIds.map(id => cacheService.userLanguageCache.delete(id)),
			...followingCacheUserIds.map(id => cacheService.userFollowingsCache.delete(id)),
		]);
		if (createdUserIds.length > 0) {
			await usersRepository.delete(createdUserIds);
		}
		noteIds.length = 0;
		userIds.length = 0;
		followingCacheUserIds.length = 0;
		createdUserIds.length = 0;
	});

	test('isLanguageVisibleToMe allows null viewer and owner visibility', async () => {
		const note = makeNote({ id: 'note-null', userId: 'user-null' });
		await setNoteLang(note.id, 'other');
		await setUserLang('viewer-empty', null, []);

		await expect(service.isLanguageVisibleToMe(note, null)).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(note, 'user-null')).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(note, 'viewer-empty')).resolves.toBe(true);
	});

	test('isLanguageVisibleToMe respects remote language', async () => {
		const note = makeNote({ id: 'note-remote', userId: 'user-remote', userHost: 'remote.example' });
		await setUserLang('viewer-remote', null, ['remote']);
		await setUserLang('viewer-ja', null, ['ja']);

		await expect(service.isLanguageVisibleToMe(note, 'viewer-remote')).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(note, 'viewer-ja')).resolves.toBe(false);
	});

	test('isLanguageVisibleToMe respects note override language', async () => {
		const note = makeNote({ id: 'note-override', userId: 'user-override' });
		await setNoteLang(note.id, 'ja');
		await setUserLang('viewer-ja', null, ['ja']);
		await setUserLang('viewer-en', null, ['other']);

		await expect(service.isLanguageVisibleToMe(note, 'viewer-ja')).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(note, 'viewer-en')).resolves.toBe(false);
	});

	test('isLanguageVisibleToMe falls back to posting language', async () => {
		const note = makeNote({ id: 'note-posting', userId: 'user-posting' });
		await setUserLang('user-posting', 'other', ['other']);
		await setUserLang('viewer-en', null, ['other']);

		await expect(service.isLanguageVisibleToMe(note, 'viewer-en')).resolves.toBe(true);
	});

	test('isLanguageVisibleToMe falls back to unknown', async () => {
		const note = makeNote({ id: 'note-unknown', userId: 'user-unknown' });
		await setUserLang('viewer-unknown', null, ['unknown']);
		await setUserLang('viewer-ja', null, ['ja']);

		await expect(service.isLanguageVisibleToMe(note, 'viewer-unknown')).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(note, 'viewer-ja')).resolves.toBe(false);
	});

	test('isLanguageVisibleToMe allows mentions and specified notes regardless of viewing languages', async () => {
		const mentionNote = makeNote({ id: 'note-mention', userId: 'user-mention', mentions: ['viewer-mention'] });
		const dmNote = makeNote({ id: 'note-dm', userId: 'user-dm', visibleUserIds: ['viewer-dm'] });
		await setNoteLang(mentionNote.id, 'ja');
		await setNoteLang(dmNote.id, 'ja');
		await setUserLang('viewer-mention', null, ['other']);
		await setUserLang('viewer-dm', null, ['other']);

		await expect(service.isLanguageVisibleToMe(mentionNote, 'viewer-mention')).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(dmNote, 'viewer-dm')).resolves.toBe(true);
	});

	test('isLanguageVisibleToMe allows hashtags when configured', async () => {
		const hashtagNote = makeNote({ id: 'note-hashtag', userId: 'user-hashtag', tags: ['misskey'] });
		await setNoteLang(hashtagNote.id, 'ja');
		await setUserLang('viewer-hashtag', null, ['other'], { showHashtagsInAllLanguages: true });
		await expect(service.isLanguageVisibleToMe(hashtagNote, 'viewer-hashtag')).resolves.toBe(true);
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
		const viewerId = 'viewer-remote';
		createdUserIds.push(viewerId);
		await usersRepository.insert({
			id: viewerId,
			username: 'viewerremote',
			usernameLower: 'viewerremote',
			host: 'viewer.example',
		});

		followingCacheUserIds.push(viewerId);
		await cacheService.userFollowingsCache.set(viewerId, {});

		const note = makePackedNote({
			visibility: 'followers',
			userId: 'author-remote',
			user: makePackedUser({
				id: 'author-remote',
				username: 'authorremote',
				host: 'author.example',
			}),
		});

		await expect(service.shouldHideNote(note, viewerId)).resolves.toBe(false);
	});

	test('shouldHideNote keeps followers notes hidden when the remote fallback does not apply', async () => {
		const remoteViewerId = 'viewer-remote-only';
		const localViewerId = 'viewer-local';
		createdUserIds.push(remoteViewerId, localViewerId);
		await usersRepository.insert([
			{
				id: remoteViewerId,
				username: 'viewerremoteonly',
				usernameLower: 'viewerremoteonly',
				host: 'viewer.example',
			},
			{
				id: localViewerId,
				username: 'viewerlocal',
				usernameLower: 'viewerlocal',
				host: null,
			},
		]);

		followingCacheUserIds.push(remoteViewerId, localViewerId);
		await Promise.all([
			cacheService.userFollowingsCache.set(remoteViewerId, {}),
			cacheService.userFollowingsCache.set(localViewerId, {}),
		]);

		const localAuthorNote = makePackedNote({
			visibility: 'followers',
			userId: 'author-local',
			user: makePackedUser({
				id: 'author-local',
				username: 'authorlocal',
				host: null,
			}),
		});
		const remoteAuthorNote = makePackedNote({
			visibility: 'followers',
			userId: 'author-remote',
			user: makePackedUser({
				id: 'author-remote',
				username: 'authorremote',
				host: 'author.example',
			}),
		});

		await expect(service.shouldHideNote(localAuthorNote, remoteViewerId)).resolves.toBe(true);
		await expect(service.shouldHideNote(remoteAuthorNote, localViewerId)).resolves.toBe(true);
	});
});
