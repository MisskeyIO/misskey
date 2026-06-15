/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { RoleService } from '@/core/RoleService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import type { Config } from '@/config.js';
import type { UsersRepository } from '@/models/_.js';
import { ApiError } from '../../error.js';

const skebGenres = ['art', 'comic', 'voice', 'novel', 'video', 'music', 'correction'] as const;

type SkebGenre = typeof skebGenres[number];

type SkebStatusResponse = {
	screen_name: string;
	is_creator: boolean;
	is_acceptable: boolean;
	creator_request_count: number;
	client_request_count: number;
	skills: { amount: number; genre: SkebGenre }[];
	ban_reason?: string | null;
	error?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSkebGenre(value: unknown): value is SkebGenre {
	return typeof value === 'string' && skebGenres.includes(value as SkebGenre);
}

export function isSkebStatusResponse(value: unknown): value is SkebStatusResponse {
	if (!isObject(value)) return false;
	if (typeof value.screen_name !== 'string') return false;
	if (typeof value.is_creator !== 'boolean') return false;
	if (typeof value.is_acceptable !== 'boolean') return false;
	if (typeof value.creator_request_count !== 'number') return false;
	if (typeof value.client_request_count !== 'number') return false;
	if (!Array.isArray(value.skills)) return false;

	return value.skills.every(skill => {
		if (!isObject(skill)) return false;
		return typeof skill.amount === 'number' && isSkebGenre(skill.genre);
	});
}

export const meta = {
	tags: ['users'],

	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 5,

	res: {
		type: 'object',
		properties: {
			screenName: {
				type: 'string',
				optional: false, nullable: false,
			},
			isCreator: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			isAcceptable: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			creatorRequestCount: {
				type: 'integer',
				optional: false, nullable: false,
			},
			clientRequestCount: {
				type: 'integer',
				optional: false, nullable: false,
			},
			skills: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'object',
					properties: {
						amount: {
							type: 'integer',
							optional: false, nullable: false,
						},
						genre: {
							type: 'string',
							optional: false, nullable: false,
							enum: skebGenres,
						},
					},
				},
			},
		},
	},

	errors: {
		skebStatusNotAvailable: {
			message: 'Skeb status is not available.',
			code: 'SKEB_STATUS_NOT_AVAILABLE',
			id: '1dd37c9c-7e97-4c24-be98-227a78b21d80',
			httpStatusCode: 403,
		},

		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '88d582ae-69d9-45e0-a8b3-13f9945e48bf',
			httpStatusCode: 404,
		},

		invalidSkebStatusResponse: {
			message: 'Invalid Skeb status response.',
			code: 'INVALID_SKEB_STATUS_RESPONSE',
			id: '968c3da6-9d2b-48f6-b9d6-5ac8e4a86b2c',
			httpStatusCode: 502,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
	},
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private roleService: RoleService,
		private loggerService: LoggerService,
		private httpRequestService: HttpRequestService,
	) {
		super(meta, paramDef, async (ps) => {
			const skebStatus = this.config.skebStatus;
			if (!skebStatus) throw new ApiError(meta.errors.skebStatusNotAvailable);

			const user = await this.usersRepository.findOneBy({ id: ps.userId });
			if (user == null) throw new ApiError(meta.errors.noSuchUser);

			const logger = this.loggerService.getLogger('api:users:get-skeb-status');
			const url = new URL(skebStatus.endpoint);
			for (const [key, value] of Object.entries(skebStatus.parameters)) {
				url.searchParams.set(key, value);
			}
			url.searchParams.set(skebStatus.userIdParameterName, ps.userId);
			const logContext = { endpointHost: url.host, endpointPathname: url.pathname, userId: ps.userId };

			logger.info('Requesting Skeb status', logContext);
			const res = await this.httpRequestService.send(
				url.href,
				{
					method: skebStatus.method,
					headers: {
						...skebStatus.headers,
						Accept: 'application/json',
					},
					timeout: 5000,
				},
				{
					throwErrorWhenResponseNotOk: false,
				},
			);

			const json: unknown = await res.json().catch(err => {
				logger.error('Failed to parse Skeb status response', { ...logContext, status: res.status, statusText: res.statusText, error: err });
				throw new ApiError(meta.errors.invalidSkebStatusResponse);
			});
			const roleId = skebStatus.roleId;
			const hasSkebRole = roleId
				? await this.roleService.getUserRoles(ps.userId).then(roles => roles.some(r => r.id === roleId))
				: false;
			const skebError = isObject(json) ? (json.error ?? json.ban_reason) : undefined;

			if (res.status > 299 || skebError) {
				logger.error('Skeb status response error', { ...logContext, status: res.status, statusText: res.statusText, error: skebError });
				if (res.status === 404 && roleId && hasSkebRole) {
					await this.roleService.unassign(ps.userId, roleId).catch(err => {
						logger.error('Failed to unassign role', { userId: ps.userId, roleId, error: err });
					});
				}
				throw new ApiError(meta.errors.noSuchUser);
			}

			if (!isSkebStatusResponse(json)) {
				logger.error('Invalid Skeb status response', { ...logContext, status: res.status, statusText: res.statusText });
				throw new ApiError(meta.errors.invalidSkebStatusResponse);
			}

			logger.info('Skeb status response', { ...logContext, status: res.status, statusText: res.statusText });

			if (roleId) {
				if (json.is_acceptable && !hasSkebRole) {
					await this.roleService.assign(ps.userId, roleId).catch(err => {
						logger.error('Failed to assign role', { userId: ps.userId, roleId, error: err });
					});
				} else if (!json.is_acceptable && hasSkebRole) {
					await this.roleService.unassign(ps.userId, roleId).catch(err => {
						logger.error('Failed to unassign role', { userId: ps.userId, roleId, error: err });
					});
				}
			}

			return {
				screenName: json.screen_name,
				isCreator: json.is_creator,
				isAcceptable: json.is_acceptable,
				creatorRequestCount: json.creator_request_count,
				clientRequestCount: json.client_request_count,
				skills: json.skills,
			};
		});
	}
}
