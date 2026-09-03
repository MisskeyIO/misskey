/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { BirthdayIndex1767169026317 } from '../../migration/1767169026317-birthday-index.js';

const legacyIndex = {
	schemaName: 'public',
	name: 'IDX_de22cd2b445eee31ae51cdbe99',
	objectType: 'i',
	tableSchema: 'public',
	tableName: 'user_profile',
	isValid: true,
	isUnique: false,
	accessMethod: 'btree',
	keyCount: 1,
	attributeCount: 1,
	keyColumns: '0',
	expression: 'substr((birthday)::text, 6, 5)',
	predicate: null,
};

const currentIndex = {
	...legacyIndex,
	name: 'IDX_USERPROFILE_BIRTHDAY_DATE',
	expression: 'get_birthday_date((birthday)::text)',
};

const birthdayFunction = {
	schemaName: 'public',
	argumentCount: 1,
	argumentType: 'text',
	returnType: 'smallint',
	language: 'plpgsql',
	volatility: 'i',
	kind: 'f',
	returnsSet: false,
	body: ' BEGIN RETURN CAST((SUBSTR(birthday, 6, 2) || SUBSTR(birthday, 9, 2)) AS SMALLINT); END; ',
};

class MockQueryRunner {
	public readonly queries: string[] = [];

	constructor(
		public indexes: Array<typeof legacyIndex>,
		public functions: Array<typeof birthdayFunction>,
		private readonly usedByLegacy = false,
	) {}

	async query(sql: string): Promise<unknown[]> {
		this.queries.push(sql);
		if (sql.includes('FROM pg_catalog.pg_class')) return this.indexes;
		if (sql.includes('FROM pg_catalog.pg_proc')) return this.functions;
		if (sql.startsWith('SELECT EXISTS')) return [{ exists: this.usedByLegacy }];
		if (sql.startsWith('DROP INDEX "public"."IDX_de22')) this.indexes = this.indexes.filter(index => index.name !== legacyIndex.name);
		if (sql.startsWith('CREATE OR REPLACE FUNCTION')) this.functions = [birthdayFunction];
		if (sql.startsWith('CREATE INDEX "IDX_USERPROFILE_BIRTHDAY_DATE"')) this.indexes.push(currentIndex);
		if (sql.startsWith('CREATE INDEX "IDX_de22')) this.indexes.push(legacyIndex);
		if (sql.startsWith('DROP INDEX "public"."IDX_USERPROFILE')) this.indexes = this.indexes.filter(index => index.name !== currentIndex.name);
		if (sql.startsWith('DROP FUNCTION')) this.functions = [];
		return [];
	}
}

describe('誕生日index migration', () => {
	test('新旧DBを安全に適用・巻き戻しし、不完全な状態を拒否する', async () => {
		const migration = new BirthdayIndex1767169026317();
		const fresh = new MockQueryRunner([legacyIndex], []);
		await migration.up(fresh);
		expect(fresh.indexes).toEqual([currentIndex]);
		expect(fresh.functions).toEqual([birthdayFunction]);

		const io = new MockQueryRunner([currentIndex], [birthdayFunction], true);
		await migration.up(io);
		await migration.down(io);
		expect(io.indexes).toEqual([currentIndex]);

		const reverted = new MockQueryRunner([currentIndex], [birthdayFunction]);
		await migration.down(reverted);
		expect(reverted.indexes).toEqual([legacyIndex]);
		expect(reverted.functions).toEqual([]);

		const drift = new MockQueryRunner([{ ...legacyIndex, isValid: false }], []);
		await expect(migration.up(drift)).rejects.toThrow('適用前状態が不正です');
	});
});
