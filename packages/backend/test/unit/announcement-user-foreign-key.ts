/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { RestoreAnnouncementUserForeignKey1788391181000 } from '../../migration/1788391181000-restore-announcement-user-foreign-key.js';

class MockQueryRunner {
	public readonly queries: string[] = [];

	constructor(private readonly orphanCount: number) {}

	async query(sql: string): Promise<Array<{ count: number }>> {
		this.queries.push(sql);
		return sql.startsWith('SELECT COUNT') ? [{ count: this.orphanCount }] : [];
	}
}

describe('announcement user foreign key migration', () => {
	test('孤児がなければ外部キーを検証する', async () => {
		const runner = new MockQueryRunner(0);

		await new RestoreAnnouncementUserForeignKey1788391181000().up(runner);

		expect(runner.queries[0]).toContain('NOT VALID');
		expect(runner.queries[2]).toContain('VALIDATE CONSTRAINT');
	});

	test('孤児があれば移行を停止する', async () => {
		const runner = new MockQueryRunner(2);

		await expect(new RestoreAnnouncementUserForeignKey1788391181000().up(runner)).rejects.toThrow('2件あります');
		expect(runner.queries).toHaveLength(2);
	});
});
