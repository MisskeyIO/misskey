/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import * as Redis from 'ioredis';
import type { AntennasRepository, UserListMembershipsRepository } from '@/models/_.js';
import { AntennaService } from '@/core/AntennaService.js';
import { FanoutTimelineService } from '@/core/FanoutTimelineService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { CacheService } from '@/core/CacheService.js';
import { DEFAULT_POLICIES, RoleService } from '@/core/RoleService.js';
import { MiAntenna } from '@/models/Antenna.js';
import { MiNote } from '@/models/Note.js';

describe('AntennaService', () => {
	function createAntenna(): MiAntenna {
		const antenna = new MiAntenna();
		antenna.id = 'antenna-id';
		antenna.lastUsedAt = new Date();
		antenna.userId = 'antenna-owner-id';
		antenna.user = null;
		antenna.name = 'test antenna';
		antenna.src = 'users';
		antenna.userListId = null;
		antenna.userList = null;
		antenna.users = ['@alice'];
		antenna.keywords = [];
		antenna.excludeKeywords = [];
		antenna.caseSensitive = false;
		antenna.excludeBots = false;
		antenna.withReplies = true;
		antenna.withFile = false;
		antenna.expression = null;
		antenna.isActive = true;
		antenna.localOnly = false;
		antenna.excludeNotesInSensitiveChannel = false;
		return antenna;
	}

	test('uses antenna owner antennaNotesLimit when retaining matched notes', async () => {
		const redisForTimelines = mockDeep<Redis.Redis>();
		const redisPipeline = mockDeep<Redis.ChainableCommander>();
		redisForTimelines.pipeline.mockReturnValue(redisPipeline);
		const redisForSub = mockDeep<Redis.Redis>();
		const antennasRepository = mockDeep<AntennasRepository>();
		const roleService = mockDeep<RoleService>();
		const utilityService = mockDeep<UtilityService>();
		const globalEventService = mockDeep<GlobalEventService>();
		const fanoutTimelineService = mockDeep<FanoutTimelineService>();
		antennasRepository.findBy.mockResolvedValue([createAntenna()]);
		roleService.getUserPolicies.mockResolvedValue({
			...DEFAULT_POLICIES,
			antennaNotesLimit: 37,
		});
		utilityService.getFullApAccount.mockImplementation((username, host) => host == null ? `@${username}` : `@${username}@${host}`);

		const service = new AntennaService(
			redisForTimelines,
			redisForSub,
			antennasRepository,
			mockDeep<UserListMembershipsRepository>(),
			mockDeep<CacheService>(),
			roleService,
			utilityService,
			globalEventService,
			fanoutTimelineService,
		);

		await service.addNoteToAntennas(new MiNote({
			id: 'note-id',
			userId: 'note-user-id',
			visibility: 'public',
			replyId: null,
			fileIds: [],
			text: 'hello',
			cw: null,
			visibleUserIds: [],
		}), {
			id: 'note-user-id',
			username: 'alice',
			host: null,
			isBot: false,
		});

		expect(roleService.getUserPolicies).toHaveBeenCalledWith('antenna-owner-id');
		expect(fanoutTimelineService.push).toHaveBeenCalledWith('antennaTimeline:antenna-id', 'note-id', 37, redisPipeline);
	});
});
