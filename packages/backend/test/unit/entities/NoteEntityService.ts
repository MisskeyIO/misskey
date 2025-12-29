import { Test, TestingModule } from '@nestjs/testing';
import type { MiNote } from '@/models/Note.js';
import type { MiUserLanguage } from '@/models/UserLanguage.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { CacheService } from '@/core/CacheService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { CoreModule } from '@/core/CoreModule.js';

process.env.NODE_ENV = 'test';

describe('NoteEntityService', () => {
	let app: TestingModule;
	let service: NoteEntityService;
	let cacheService: CacheService;
	const userIds: string[] = [];
	const noteIds: string[] = [];

	function makeNote(data: Partial<MiNote>): MiNote {
		return {
			id: 'note',
			userId: 'user',
			userHost: null,
			user: null,
			...data,
		} as MiNote;
	}

	async function setUserLang(userId: string, postingLang: string | null, viewingLangs: string[]) {
		userIds.push(userId);
		const entry: MiUserLanguage = {
			userId,
			user: null,
			postingLang,
			viewingLangs,
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
	});

	afterAll(async () => {
		await app.close();
	});

	afterEach(async () => {
		await Promise.all([
			...noteIds.map(id => cacheService.noteLanguageCache.delete(id)),
			...userIds.map(id => cacheService.userLanguageCache.delete(id)),
		]);
		noteIds.length = 0;
		userIds.length = 0;
	});

	test('isLanguageVisibleToMe allows null viewer and owner visibility', async () => {
		const note = makeNote({ id: 'note-null', userId: 'user-null' });
		await setNoteLang(note.id, 'en');
		await setUserLang('viewer-empty', null, []);

		await expect(service.isLanguageVisibleToMe(note, null)).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(note, 'user-null')).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(note, 'viewer-empty')).resolves.toBe(false);
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
		await setUserLang('viewer-en', null, ['en']);

		await expect(service.isLanguageVisibleToMe(note, 'viewer-ja')).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(note, 'viewer-en')).resolves.toBe(false);
	});

	test('isLanguageVisibleToMe falls back to posting language', async () => {
		const note = makeNote({ id: 'note-posting', userId: 'user-posting' });
		await setUserLang('user-posting', 'en', ['en']);
		await setUserLang('viewer-en', null, ['en']);

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
		await setUserLang('viewer-mention', null, ['en']);
		await setUserLang('viewer-dm', null, ['en']);

		await expect(service.isLanguageVisibleToMe(mentionNote, 'viewer-mention')).resolves.toBe(true);
		await expect(service.isLanguageVisibleToMe(dmNote, 'viewer-dm')).resolves.toBe(true);
	});
});
