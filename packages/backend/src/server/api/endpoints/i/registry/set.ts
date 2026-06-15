/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { RegistryApiService } from '@/core/RegistryApiService.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	requireCredential: true,
	kind: 'write:account',

	errors: {
		restrictedByRole: {
			message: 'This feature is restricted by your role.',
			code: 'RESTRICTED_BY_ROLE',
			id: '8feff0ba-5ab5-585b-31f4-4df816663fad',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		key: { type: 'string', minLength: 1 },
		value: {},
		scope: { type: 'array', default: [], items: {
			type: 'string', pattern: /^[a-zA-Z0-9_]+$/.toString().slice(1, -1),
		} },
		domain: { type: 'string', nullable: true },
	},
	required: ['key', 'value', 'scope'],
} as const;

const soundSettingKeys = new Set([
	'sound.on.note',
	'sound.on.noteMy',
	'sound.on.notification',
	'sound.on.reaction',
	'sound.on.chatMessage',
]);

function normalizePreferenceKey(key: string): string {
	const delimiterIndex = key.indexOf(':');
	return delimiterIndex === -1 ? key : key.slice(delimiterIndex + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isDriveFileSoundValue(value: unknown): boolean {
	return isRecord(value) && value.type === '_driveFile_';
}

function containsDriveFileSoundValue(value: unknown): boolean {
	if (isDriveFileSoundValue(value)) return true;

	return Array.isArray(value) && value.some(record => Array.isArray(record) && isDriveFileSoundValue(record[1]));
}

function isDriveFileSoundSetting(key: string, value: unknown): boolean {
	return soundSettingKeys.has(normalizePreferenceKey(key)) && containsDriveFileSoundValue(value);
}

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private registryApiService: RegistryApiService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me, accessToken) => {
			if (isDriveFileSoundSetting(ps.key, ps.value)) {
				const policies = await this.roleService.getUserPolicies(me.id);
				if (!policies.canUseDriveFileInSoundSettings) throw new ApiError(meta.errors.restrictedByRole);
			}

			await this.registryApiService.set(me.id, accessToken ? accessToken.id : (ps.domain ?? null), ps.scope, ps.key, ps.value);
		});
	}
}
