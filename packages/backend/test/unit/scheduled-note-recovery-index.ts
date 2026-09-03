/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, jest, test } from '@jest/globals';
import { IndexScheduledNoteDraftRecovery1788391180000 } from '../../migration/1788391180000-index-scheduled-note-draft-recovery.js';

describe('予約draft回収index', () => {
	test('scheduledAtとidを使うpartial indexを作成する', async () => {
		const query = jest.fn(async (_sql: string) => undefined);
		const migration = new IndexScheduledNoteDraftRecovery1788391180000();

		await migration.up({ query });

		expect(query).toHaveBeenCalledWith(expect.stringContaining('("scheduledAt", "id")'));
		expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE "isActuallyScheduled" = true AND "scheduledFailureReason" IS NULL AND "scheduledAt" IS NOT NULL'));
	});
});
