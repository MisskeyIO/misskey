/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserListsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['lists'],

	requireCredential: true,
	requireRolePolicy: 'canUpdateContent',

	kind: 'write:account',

	description: 'Update the properties of a list.',

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'UserList',
	},

	errors: {
		noSuchList: {
			message: 'No such list.',
			code: 'NO_SUCH_LIST',
			id: '796666fe-3dff-4d39-becb-8a5932c1d5b7',
		},

		listLimitExceeded: {
			message: 'You cannot update the list because you have exceeded the limit of lists.',
			code: 'LIST_LIMIT_EXCEEDED',
			id: '0a1fa63e-3e4c-4bc2-afd1-1ff853b4560e',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		listId: { type: 'string', format: 'misskey:id' },
		name: { type: 'string', minLength: 1, maxLength: 100 },
		isPublic: { type: 'boolean' },
	},
	required: ['listId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,

		private userListEntityService: UserListEntityService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const userList = await this.userListsRepository.findOneBy({
				id: ps.listId,
				userId: me.id,
			});

			if (userList == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			const currentCount = await this.userListsRepository.countBy({
				userId: me.id,
			});
			if (currentCount > (await this.roleService.getUserPolicies(me.id)).userListLimit) {
				throw new ApiError(meta.errors.listLimitExceeded);
			}

			await this.userListsRepository.update(userList.id, {
				name: ps.name,
				isPublic: ps.isPublic,
			});

			return await this.userListEntityService.pack(userList.id);
		});
	}
}
