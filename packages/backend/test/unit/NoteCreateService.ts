/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeAll, describe, test, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { mockDeep } from 'vitest-mock-extended';

import { CoreModule } from '@/core/CoreModule.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { DEFAULT_POLICIES, RoleService } from '@/core/RoleService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { MiNote } from '@/models/Note.js';
import { IPoll } from '@/models/Poll.js';
import { MiDriveFile } from '@/models/DriveFile.js';
import { MiUser } from '@/models/User.js';
import type { UsersRepository } from '@/models/_.js';

describe('NoteCreateService', () => {
	let noteCreateService: NoteCreateService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		noteCreateService = app.get<NoteCreateService>(NoteCreateService);
	});

	afterEach(() => {
		delete process.env.MISSKEY_BLOCK_MENTIONS_FROM_UNFAMILIAR_REMOTE_USERS;
		Reflect.deleteProperty(noteCreateService, 'insertNote');
		Reflect.deleteProperty(noteCreateService, 'postNoteCreated');
		vi.restoreAllMocks();
	});

		describe('is-renote', () => {
		const base: MiNote = {
			id: 'some-note-id',
			replyId: null,
			reply: null,
			renoteId: null,
			renote: null,
			threadId: null,
			dimension: 0,
			text: null,
			name: null,
			cw: null,
			userId: 'some-user-id',
			user: null,
			localOnly: false,
			reactionAcceptance: null,
			renoteCount: 0,
			repliesCount: 0,
			clippedCount: 0,
			pageCount: 0,
			reactions: {},
			visibility: 'public',
			uri: null,
			url: null,
			fileIds: [],
			attachedFileTypes: [],
			visibleUserIds: [],
			mentions: [],
			mentionedRemoteUsers: '',
			reactionAndUserPairCache: [],
			emojis: [],
			tags: [],
			hasPoll: false,
			channelId: null,
			channel: null,
			userHost: null,
			replyUserId: null,
			replyUserHost: null,
			renoteUserId: null,
			renoteUserHost: null,
			renoteChannelId: null,
		};

		const poll: IPoll = {
			choices: ['kinoko', 'takenoko'],
			multiple: false,
			expiresAt: null,
		};

		const file: MiDriveFile = {
			id: 'some-file-id',
			userId: null,
			user: null,
			userHost: null,
			md5: '',
			name: '',
			type: '',
			size: 0,
			comment: null,
			blurhash: null,
			properties: {},
			storedInternal: false,
			url: '',
			thumbnailUrl: null,
			webpublicUrl: null,
			webpublicType: null,
			accessKey: null,
			thumbnailAccessKey: null,
			webpublicAccessKey: null,
			uri: null,
			src: null,
			folderId: null,
			folder: null,
			isSensitive: false,
			isSensitiveByModerator: false,
			maybeSensitive: false,
			maybePorn: false,
			isLink: false,
			requestHeaders: null,
			requestIp: null,
		};

		test('note without renote should not be Renote', () => {
			const note = { renote: null };
			expect(noteCreateService['isRenote'](note)).toBe(false);
		});

		test('note with renote should be Renote and not be Quote', () => {
			const note = { renote: base };
			expect(noteCreateService['isRenote'](note)).toBe(true);
			expect(noteCreateService['isQuote'](note)).toBe(false);
		});

		test('note with renote and text should be Quote', () => {
			const note = { renote: base, text: 'some-text' };
			expect(noteCreateService['isRenote'](note)).toBe(true);
			expect(noteCreateService['isQuote'](note)).toBe(true);
		});

		test('note with renote and cw should be Quote', () => {
			const note = { renote: base, cw: 'some-cw' };
			expect(noteCreateService['isRenote'](note)).toBe(true);
			expect(noteCreateService['isQuote'](note)).toBe(true);
		});

		test('note with renote and reply should be Quote', () => {
			const note = { renote: base, reply: { ...base, id: 'another-note-id' } };
			expect(noteCreateService['isRenote'](note)).toBe(true);
			expect(noteCreateService['isQuote'](note)).toBe(true);
		});

		test('note with renote and poll should be Quote', () => {
			const note = { renote: base, poll };
			expect(noteCreateService['isRenote'](note)).toBe(true);
			expect(noteCreateService['isQuote'](note)).toBe(true);
		});

		test('note with renote and non-empty files should be Quote', () => {
			const note = { renote: base, files: [file] };
			expect(noteCreateService['isRenote'](note)).toBe(true);
			expect(noteCreateService['isQuote'](note)).toBe(true);
		});
	});

	describe('scheduled notes', () => {
		test('rejects scheduled note creation when policy disables scheduling', async () => {
			const roleService = mockDeep<RoleService>();
			const utilityService = mockDeep<UtilityService>();
			noteCreateService['roleService'] = roleService;
			noteCreateService['utilityService'] = utilityService;
			noteCreateService['meta'].sensitiveWords = [];
			noteCreateService['meta'].prohibitedWords = [];
			noteCreateService['meta'].silencedHosts = [];
			noteCreateService['meta'].mediaSilencedHosts = [];
			roleService.getUserPolicies.mockResolvedValue({
				...DEFAULT_POLICIES,
				canPublicNote: true,
				canScheduleNote: false,
				scheduledNoteLimit: 10,
				scheduleNoteMaxDays: 365,
			});
			utilityService.isKeyWordIncluded.mockReturnValue(false);
			utilityService.isSilencedHost.mockReturnValue(false);
			utilityService.isMediaSilencedHost.mockReturnValue(false);

			await expect(noteCreateService.create({
				id: 'user-id',
				username: 'alice',
				host: null,
				isBot: false,
				isCat: false,
			}, {
				text: 'scheduled note',
				scheduledAt: new Date(Date.now() + 1000 * 60 * 60),
			})).rejects.toThrow('Scheduled notes are not allowed');
		});
	});

	describe('remote mention guard', () => {
		const remoteUser = {
			id: 'remote-user-id',
			username: 'remote',
			host: 'remote.example',
			isBot: false,
			isCat: false,
		};

		const localMention = {
			id: 'local-user-id',
			username: 'local',
			host: null,
			uri: null,
		};

		function setupCreateMocks(followersCount: number) {
			const roleService = mockDeep<RoleService>();
			const utilityService = mockDeep<UtilityService>();
			const usersRepository = mockDeep<UsersRepository>();

			noteCreateService['roleService'] = roleService;
			noteCreateService['utilityService'] = utilityService;
			noteCreateService['usersRepository'] = usersRepository;
			noteCreateService['meta'].sensitiveWords = [];
			noteCreateService['meta'].prohibitedWords = [];
			noteCreateService['meta'].silencedHosts = [];
			noteCreateService['meta'].mediaSilencedHosts = [];

			roleService.getUserPolicies.mockResolvedValue({
				...DEFAULT_POLICIES,
				canPublicNote: true,
			});
			utilityService.isKeyWordIncluded.mockReturnValue(false);
			utilityService.isSilencedHost.mockReturnValue(false);
			utilityService.isMediaSilencedHost.mockReturnValue(false);
			usersRepository.findOne.mockResolvedValue(new MiUser({
				id: remoteUser.id,
				username: remoteUser.username,
				host: remoteUser.host,
				followersCount,
			}));

			const insertedNote = new MiNote({ id: 'created-note-id' });
			Object.defineProperty(noteCreateService, 'insertNote', {
				configurable: true,
				value: vi.fn().mockResolvedValue(insertedNote),
			});
			Object.defineProperty(noteCreateService, 'postNoteCreated', {
				configurable: true,
				value: vi.fn(),
			});

			return { usersRepository };
		}

		test('rejects remote note mentioning a local user when env gate is enabled and author has no followers', async () => {
			process.env.MISSKEY_BLOCK_MENTIONS_FROM_UNFAMILIAR_REMOTE_USERS = 'true';
			setupCreateMocks(0);

			await expect(noteCreateService.create(remoteUser, {
				text: 'hello @local',
				apMentions: [localMention],
			})).rejects.toMatchObject({
				id: 'e829c0e1-68c3-4d33-a2d5-0f4a7f6b3a61',
				message: 'Note rejected',
			});
		});

		test('does not apply the remote mention guard when env gate is unset', async () => {
			const { usersRepository } = setupCreateMocks(0);

			await expect(noteCreateService.create(remoteUser, {
				text: 'hello @local',
				apMentions: [localMention],
			})).resolves.toMatchObject({ id: 'created-note-id' });
			await new Promise<void>(resolve => setImmediate(resolve));
			expect(usersRepository.findOne).not.toHaveBeenCalled();
			expect(noteCreateService['insertNote']).toHaveBeenCalled();
		});
	});
});
