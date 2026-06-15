/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MiUserAccountMoveLog, UserAccountMoveLogsRepository } from '@/models/_.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { MiUser } from '@/models/User.js';
import { bindThis } from '@/decorators.js';
import type { Packed } from '@/misc/json-schema.js';
import { UserEntityService } from './UserEntityService.js';

@Injectable()
export class UserAccountMoveLogEntityService {
	constructor(
		@Inject(DI.userAccountMoveLogsRepository)
		private userAccountMoveLogsRepository: UserAccountMoveLogsRepository,

		private userEntityService: UserEntityService,
	) {
	}

	@bindThis
	public async pack(
		src: MiUserAccountMoveLog['id'] | MiUserAccountMoveLog,
		me: { id: MiUser['id'] } | null | undefined,
		hint?: {
			packedMovedFrom?: Packed<'UserDetailedNotMe'>,
			packedMovedTo?: Packed<'UserDetailedNotMe'>,
		},
	): Promise<Packed<'UserAccountMoveLog'>> {
		const log = typeof src === 'object' ? src : await this.userAccountMoveLogsRepository.findOneByOrFail({ id: src });

		return await awaitAll({
			id: log.id,
			createdAt: log.createdAt.toISOString(),
			movedFromId: log.movedFromId,
			movedFrom: hint?.packedMovedFrom ?? this.userEntityService.pack(log.movedFrom ?? log.movedFromId, me, {
				schema: 'UserDetailedNotMe',
			}),
			movedToId: log.movedToId,
			movedTo: hint?.packedMovedTo ?? this.userEntityService.pack(log.movedTo ?? log.movedToId, me, {
				schema: 'UserDetailedNotMe',
			}),
		});
	}

	@bindThis
	public async packMany(
		logs: MiUserAccountMoveLog[],
		me: { id: MiUser['id'] } | null | undefined,
	): Promise<Packed<'UserAccountMoveLog'>[]> {
		const _movedFromUsers = logs.map(({ movedFrom, movedFromId }) => movedFrom ?? movedFromId);
		const _movedToUsers = logs.map(({ movedTo, movedToId }) => movedTo ?? movedToId);
		const _userMap = await this.userEntityService.packMany(
			[..._movedFromUsers, ..._movedToUsers],
			me,
			{ schema: 'UserDetailedNotMe' },
		).then(users => new Map(users.map(u => [u.id, u])));

		return (await Promise.allSettled(logs.map(log => {
			const packedMovedFrom = _userMap.get(log.movedFromId);
			const packedMovedTo = _userMap.get(log.movedToId);
			return this.pack(log, me, { packedMovedFrom, packedMovedTo });
		})))
			.filter(result => result.status === 'fulfilled')
			.map(result => result.value);
	}
}
