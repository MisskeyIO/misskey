/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'assert';
import { beforeAll, describe, expect, test } from 'vitest';
import { Test } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';

import { CoreModule } from '@/core/CoreModule.js';
import { ReactionService } from '@/core/ReactionService.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { FeaturedService } from '@/core/FeaturedService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { IdService } from '@/core/IdService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { ReactionsBufferingService } from '@/core/ReactionsBufferingService.js';
import { DEFAULT_POLICIES, RoleService } from '@/core/RoleService.js';
import { UserBlockingService } from '@/core/UserBlockingService.js';
import { UtilityService } from '@/core/UtilityService.js';
import PerUserReactionsChart from '@/core/chart/charts/per-user-reactions.js';
import { GlobalModule } from '@/GlobalModule.js';
import type { EmojisRepository, MiMeta, NoteReactionsRepository, NotesRepository, UsersRepository } from '@/models/_.js';
import { MiEmoji } from '@/models/Emoji.js';
import { MiNote } from '@/models/Note.js';
import { MiRole } from '@/models/Role.js';

describe('ReactionService', () => {
	let reactionService: ReactionService;

	type CreateTestContext = {
		reactionService: ReactionService;
		noteReactionsRepository: DeepMockProxy<NoteReactionsRepository>;
		roleService: DeepMockProxy<RoleService>;
		customEmojiService: DeepMockProxy<CustomEmojiService>;
	};

	function createMeta(): DeepMockProxy<MiMeta> {
		const meta = mockDeep<MiMeta>();
		meta.enableReactionsBuffering = true;
		meta.enableChartsForRemoteUser = false;
		meta.mediaSilencedHosts = [];
		return meta;
	}

	function createNote(): MiNote {
		return new MiNote({
			id: 'note-id',
			replyId: null,
			reply: null,
			renoteId: null,
			renote: null,
			threadId: null,
			text: 'note',
			name: null,
			cw: null,
			userId: 'note-user',
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
			mentionedRemoteUsers: '[]',
			dimension: 0,
			reactionAndUserPairCache: [],
			emojis: [],
			tags: [],
			hasPoll: false,
			channelId: null,
			channel: null,
			userHost: 'remote.example',
			replyUserId: null,
			replyUserHost: null,
			renoteUserId: null,
			renoteUserHost: null,
			renoteChannelId: null,
		});
	}

	function createEmoji(roleIdsThatCanBeUsedThisEmojiAsReaction: string[], roleIdsThatCanNotBeUsedThisEmojiAsReaction: string[] = []): MiEmoji {
		const emoji = new MiEmoji();
		emoji.id = 'emoji-id';
		emoji.updatedAt = null;
		emoji.name = 'party';
		emoji.host = null;
		emoji.category = null;
		emoji.originalUrl = 'https://example.test/party.png';
		emoji.publicUrl = 'https://example.test/party.png';
		emoji.uri = null;
		emoji.type = 'image/png';
		emoji.aliases = [];
		emoji.license = null;
		emoji.localOnly = false;
		emoji.isSensitive = false;
		emoji.requestedBy = null;
		emoji.memo = '';
		emoji.roleIdsThatCanBeUsedThisEmojiAsReaction = roleIdsThatCanBeUsedThisEmojiAsReaction;
		emoji.roleIdsThatCanNotBeUsedThisEmojiAsReaction = roleIdsThatCanNotBeUsedThisEmojiAsReaction;
		return emoji;
	}

	function createRole(id: string): MiRole {
		const role = new MiRole();
		role.id = id;
		role.updatedAt = new Date();
		role.lastUsedAt = new Date();
		role.name = id;
		role.description = '';
		role.color = null;
		role.iconUrl = null;
		role.target = 'manual';
		role.condFormula = { id: 'cond', type: 'isLocal' };
		role.isPublic = false;
		role.asBadge = false;
		role.badgeBehavior = null;
		role.isModerator = false;
		role.isAdministrator = false;
		role.isExplorable = false;
		role.preserveAssignmentOnMoveAccount = false;
		role.canEditMembersByModerator = false;
		role.displayOrder = 0;
		role.policies = {};
		return role;
	}

	function createServiceForCreateTests(emoji = createEmoji([])): CreateTestContext {
		const usersRepository = mockDeep<UsersRepository>();
		const notesRepository = mockDeep<NotesRepository>();
		const noteReactionsRepository = mockDeep<NoteReactionsRepository>();
		const emojisRepository = mockDeep<EmojisRepository>();
		const utilityService = mockDeep<UtilityService>();
		const customEmojiService = mockDeep<CustomEmojiService>();
		const roleService = mockDeep<RoleService>();
		const userEntityService = mockDeep<UserEntityService>();
		const noteEntityService = mockDeep<NoteEntityService>();
		const userBlockingService = mockDeep<UserBlockingService>();
		const reactionsBufferingService = mockDeep<ReactionsBufferingService>();
		const idService = mockDeep<IdService>();
		const featuredService = mockDeep<FeaturedService>();
		const globalEventService = mockDeep<GlobalEventService>();
		const apRendererService = mockDeep<ApRendererService>();
		const apDeliverManagerService = mockDeep<ApDeliverManagerService>();
		const notificationService = mockDeep<NotificationService>();
		const perUserReactionsChart = mockDeep<PerUserReactionsChart>();

		utilityService.toPunyNullable.mockImplementation(host => host ?? null);
		utilityService.isMediaSilencedHost.mockReturnValue(false);
		customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([[emoji.name, emoji]]));
		roleService.getUserPolicies.mockResolvedValue({ ...DEFAULT_POLICIES, canUseReaction: true });
		roleService.getUserRoles.mockResolvedValue([]);
		noteEntityService.isVisibleForMe.mockResolvedValue(true);
		userBlockingService.checkBlocked.mockResolvedValue(false);
		userEntityService.isLocalUser.mockReturnValue(false);
		idService.gen.mockReturnValue('reaction-id');
		idService.parse.mockReturnValue({ date: new Date(0) });

		return {
			reactionService: new ReactionService(
				createMeta(),
				usersRepository,
				notesRepository,
				noteReactionsRepository,
				emojisRepository,
				utilityService,
				customEmojiService,
				roleService,
				userEntityService,
				noteEntityService,
				userBlockingService,
				reactionsBufferingService,
				idService,
				featuredService,
				globalEventService,
				apRendererService,
				apDeliverManagerService,
				notificationService,
				perUserReactionsChart,
			),
			noteReactionsRepository,
			roleService,
			customEmojiService,
		};
	}

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		reactionService = app.get<ReactionService>(ReactionService);
	});

	describe('normalize', () => {
		test('絵文字リアクションはそのまま', () => {
			assert.strictEqual(reactionService.normalize('👍'), '👍');
			assert.strictEqual(reactionService.normalize('🍅'), '🍅');
		});

		test('既存のリアクションは絵文字化する pudding', () => {
			assert.strictEqual(reactionService.normalize('pudding'), '🍮');
		});

		test('既存のリアクションは絵文字化する like', () => {
			assert.strictEqual(reactionService.normalize('like'), '👍');
		});

		test('既存のリアクションは絵文字化する love', () => {
			assert.strictEqual(reactionService.normalize('love'), '❤');
		});

		test('既存のリアクションは絵文字化する laugh', () => {
			assert.strictEqual(reactionService.normalize('laugh'), '😆');
		});

		test('既存のリアクションは絵文字化する hmm', () => {
			assert.strictEqual(reactionService.normalize('hmm'), '🤔');
		});

		test('既存のリアクションは絵文字化する surprise', () => {
			assert.strictEqual(reactionService.normalize('surprise'), '😮');
		});

		test('既存のリアクションは絵文字化する congrats', () => {
			assert.strictEqual(reactionService.normalize('congrats'), '🎉');
		});

		test('既存のリアクションは絵文字化する angry', () => {
			assert.strictEqual(reactionService.normalize('angry'), '💢');
		});

		test('既存のリアクションは絵文字化する confused', () => {
			assert.strictEqual(reactionService.normalize('confused'), '😥');
		});

		test('既存のリアクションは絵文字化する rip', () => {
			assert.strictEqual(reactionService.normalize('rip'), '😇');
		});

		test('既存のリアクションは絵文字化する star', () => {
			assert.strictEqual(reactionService.normalize('star'), '⭐');
		});

		test('異体字セレクタ除去', () => {
			assert.strictEqual(reactionService.normalize('㊗️'), '㊗');
		});

		test('異体字セレクタ除去 必要なし', () => {
			assert.strictEqual(reactionService.normalize('㊗'), '㊗');
		});

		test('fallback - null', () => {
			assert.strictEqual(reactionService.normalize(null), '❤');
		});

		test('fallback - empty', () => {
			assert.strictEqual(reactionService.normalize(''), '❤');
		});

		test('fallback - unknown', () => {
			assert.strictEqual(reactionService.normalize('unknown'), '❤');
		});
	});

	describe('convertLegacyReactions', () => {
		test('空の入力に対しては何もしない', () => {
			const input = {};
			assert.deepStrictEqual(reactionService.convertLegacyReactions(input), input);
		});

		test('Unicode絵文字リアクションを変換してしまわない', () => {
			const input = { '👍': 1, '🍮': 2 };
			assert.deepStrictEqual(reactionService.convertLegacyReactions(input), input);
		});

		test('カスタム絵文字リアクションを変換してしまわない', () => {
			const input = { ':like@.:': 1, ':pudding@example.tld:': 2 };
			assert.deepStrictEqual(reactionService.convertLegacyReactions(input), input);
		});

		test('文字列によるレガシーなリアクションを変換する', () => {
			const input = { 'like': 1, 'pudding': 2 };
			const output = { '👍': 1, '🍮': 2 };
			assert.deepStrictEqual(reactionService.convertLegacyReactions(input), output);
		});

		test('host部分が省略されたレガシーなカスタム絵文字リアクションを変換する', () => {
			const input = { ':custom_emoji:': 1 };
			const output = { ':custom_emoji@.:': 1 };
			assert.deepStrictEqual(reactionService.convertLegacyReactions(input), output);
		});

		test('「0個のリアクション」情報を削除する', () => {
			const input = { 'angry': 0 };
			const output = {};
			assert.deepStrictEqual(reactionService.convertLegacyReactions(input), output);
		});

		test('host部分の有無によりデコードすると同じ表記になるカスタム絵文字リアクションの個数情報を正しく足し合わせる', () => {
			const input = { ':custom_emoji:': 1, ':custom_emoji@.:': 2 };
			const output = { ':custom_emoji@.:': 3 };
			assert.deepStrictEqual(reactionService.convertLegacyReactions(input), output);
		});
	});

	describe('create', () => {
		test('allowed role can use restricted custom emoji reaction', async () => {
			const ctx = createServiceForCreateTests(createEmoji(['role-allowed']));
			ctx.roleService.getUserRoles.mockResolvedValue([createRole('role-allowed')]);

			await ctx.reactionService.create({ id: 'reactor', host: null, isBot: false }, createNote(), ':party:');

			expect(ctx.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
				reaction: ':party:',
			}));
		});

		test('restricted custom emoji reaction falls back when user lacks allowed role', async () => {
			const ctx = createServiceForCreateTests(createEmoji(['role-allowed']));
			ctx.roleService.getUserRoles.mockResolvedValue([createRole('role-other')]);

			await ctx.reactionService.create({ id: 'reactor', host: null, isBot: false }, createNote(), ':party:');

			expect(ctx.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
				reaction: '❤',
			}));
		});

		test('denied role overrides allowed custom emoji reaction', async () => {
			const ctx = createServiceForCreateTests(createEmoji(['role-allowed'], ['role-denied']));
			ctx.roleService.getUserRoles.mockResolvedValue([createRole('role-allowed'), createRole('role-denied')]);

			await ctx.reactionService.create({ id: 'reactor', host: null, isBot: false }, createNote(), ':party:');

			expect(ctx.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
				reaction: '❤',
			}));
		});

		test('canUseReaction false forces the like-only fallback', async () => {
			const ctx = createServiceForCreateTests(createEmoji([]));
			ctx.roleService.getUserPolicies.mockResolvedValue({ ...DEFAULT_POLICIES, canUseReaction: false });

			await ctx.reactionService.create({ id: 'reactor', host: null, isBot: false }, createNote(), ':party:');

			expect(ctx.customEmojiService.localEmojisCache.fetch).not.toHaveBeenCalled();
			expect(ctx.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
				reaction: '❤',
			}));
		});
	});
});
