/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { setImmediate } from 'node:timers/promises';
import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { mock, mockDeep } from 'vitest-mock-extended';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import type { FollowingsRepository, MiFollowing, UsersRepository } from '@/models/_.js';
import type { MiLocalUser } from '@/models/User.js';
import type { UpdateResult } from 'typeorm';

describe('UserFollowingService', () => {
	test.each(['unfollow', 'rejectFollow'] as const)('%s は件数の減算完了を待つ', async (method) => {
		const follower = mock<MiLocalUser>({ id: 'follower', host: null, movedToUri: null });
		const followee = mock<MiLocalUser>({ id: 'followee', host: null, movedToUri: null });
		const usersRepository = mock<UsersRepository>();
		const followingsRepository = mock<FollowingsRepository>();
		const userEntityService = mock<UserEntityService>();
		followingsRepository.findOne.mockResolvedValue(mock<MiFollowing>({ id: 'following', follower, followee }));
		userEntityService.isLocalUser.mockReturnValue(true);
		userEntityService.isRemoteUser.mockReturnValue(false);

		const app = await Test.createTestingModule({
			providers: [
				UserFollowingService,
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.followingsRepository, useValue: followingsRepository },
				{ provide: DI.meta, useValue: { enableStatsForFederatedInstances: false } },
				{ provide: UserEntityService, useValue: userEntityService },
			],
		}).useMocker(() => mockDeep()).compile();
		const service = app.get(UserFollowingService);
		const started = Promise.withResolvers<void>();
		const decrement = Promise.withResolvers<UpdateResult>();
		usersRepository.decrement.mockImplementation(() => {
			started.resolve();
			return decrement.promise;
		});

		const completed = vi.fn();
		const operation = (method === 'unfollow'
			? service.unfollow(follower, followee, true)
			: service.rejectFollow(followee, follower)).then(completed);

		try {
			await started.promise;
			// 減算を止めたまま、残りの Promise 処理を排出する。
			await setImmediate();
			expect(usersRepository.decrement).toHaveBeenCalledTimes(2);
			expect(usersRepository.decrement).toHaveBeenCalledWith({ id: follower.id }, 'followingCount', 1);
			expect(usersRepository.decrement).toHaveBeenCalledWith({ id: followee.id }, 'followersCount', 1);
			expect(completed).not.toHaveBeenCalled();
		} finally {
			decrement.resolve({ affected: 1, generatedMaps: [], raw: [] });
			await operation;
			await app.close();
		}
		expect(completed).toHaveBeenCalledOnce();
	});
});
