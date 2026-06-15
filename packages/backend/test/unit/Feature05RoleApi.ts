/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { paramDef as assignParamDef } from '@/server/api/endpoints/admin/roles/assign.js';
import { paramDef as createParamDef } from '@/server/api/endpoints/admin/roles/create.js';
import { paramDef as updateInlinePoliciesParamDef } from '@/server/api/endpoints/admin/roles/update-inline-policies.js';
import { paramDef as updateParamDef } from '@/server/api/endpoints/admin/roles/update.js';
import { meta as purgeTimelineCacheMeta } from '@/server/api/endpoints/i/purge-timeline-cache.js';
import { meta as scheduledCancelMeta } from '@/server/api/endpoints/notes/scheduled/cancel.js';
import { meta as roleUsersMeta } from '@/server/api/endpoints/admin/roles/users.js';
import { packedRolePoliciesSchema, packedRoleSchema } from '@/models/json-schema/role.js';

describe('Feature 05 role API shape', () => {
	test('admin role assignment accepts memo and role users returns memo', () => {
		expect(assignParamDef.properties).toHaveProperty('memo');
		expect(roleUsersMeta.res.items.properties).toHaveProperty('memo');
	});

	test('role API shapes expose badgeBehavior', () => {
		expect(createParamDef.properties).toHaveProperty('badgeBehavior');
		expect(updateParamDef.properties).toHaveProperty('badgeBehavior');
		expect(packedRoleSchema).toHaveProperty(['allOf', 1, 'properties', 'badgeBehavior']);
	});

	test('inline policy update endpoint validates known policies and supported operations', () => {
		const policyItem = updateInlinePoliciesParamDef.properties.policies.items;

		expect(updateInlinePoliciesParamDef.required).toEqual(['userId', 'policies']);
		expect(policyItem.properties.policy.enum).toContain('canIgnoreAiNsfw');
		expect(policyItem.properties.policy.enum).toContain('canScheduleNote');
		expect(policyItem.properties.policy.enum).toContain('scheduleNoteMaxDays');
		expect(policyItem.properties.policy.enum).toContain('antennaNotesLimit');
		expect(policyItem.properties.policy.enum).toContain('canCreateContent');
		expect(policyItem.properties.policy.enum).toContain('canDeleteContent');
		expect(policyItem.properties.operation.enum).toEqual(['set', 'increment']);
		expect(policyItem.properties.value.oneOf).toEqual([
			{ type: 'boolean' },
			{ type: 'number' },
			{ type: 'string' },
			{ type: 'array', items: { type: 'string' } },
			{ type: 'null' },
		]);
	});

	test('packed role policies expose schedule/content/antenna policy keys', () => {
		expect(packedRolePoliciesSchema.properties).toHaveProperty('canScheduleNote');
		expect(packedRolePoliciesSchema.properties).toHaveProperty('scheduleNoteMaxDays');
		expect(packedRolePoliciesSchema.properties).toHaveProperty('antennaNotesLimit');
		expect(packedRolePoliciesSchema.properties).toHaveProperty('canCreateContent');
		expect(packedRolePoliciesSchema.properties).toHaveProperty('canDeleteContent');
	});

	test('content policy endpoint metadata uses requiredRolePolicy', () => {
		expect(scheduledCancelMeta).toHaveProperty('requiredRolePolicy', 'canCreateContent');
		expect(scheduledCancelMeta).not.toHaveProperty('requireRolePolicy');
		expect(purgeTimelineCacheMeta).toHaveProperty('requiredRolePolicy', 'canDeleteContent');
		expect(purgeTimelineCacheMeta).not.toHaveProperty('requireRolePolicy');
	});
});
