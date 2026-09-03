/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { SensitiveAd1757823175259 } from '../../migration/1757823175259-sensitive-ad.js';
import { ScheduledPost1758677617888 } from '../../migration/1758677617888-scheduled-post.js';
import { AddIsSensitiveToAd1765736186185 } from '../../migration/1765736186185-AddIsSensitiveToAd.js';
import { NoteDraftIoFields1788353769000 } from '../../migration/1788353769000-note-draft-io-fields.js';

type Column = {
	name: string;
	type: string;
	isNullable: boolean;
	default?: unknown;
	length?: string;
};

const definitions: Record<string, Column> = {
	'ad.isSensitive': { name: 'isSensitive', type: 'boolean', isNullable: false, default: 'false' },
	'ad.imageBlurhash': { name: 'imageBlurhash', type: 'character varying', length: '128', isNullable: true },
	'note_draft.scheduledAt': { name: 'scheduledAt', type: 'timestamp with time zone', isNullable: true },
	'note_draft.isActuallyScheduled': { name: 'isActuallyScheduled', type: 'boolean', isNullable: false, default: 'false' },
	'note_draft.dimension': { name: 'dimension', type: 'integer', isNullable: true },
	'note_draft.lang': { name: 'lang', type: 'character varying', length: '32', isNullable: true },
};

class MockTable {
	constructor(public columns: Column[]) {}

	findColumnByName(name: string): Column | undefined {
		return this.columns.find(column => column.name === name);
	}
}

class MockQueryRunner {
	public readonly queries: string[] = [];

	constructor(
		public readonly tables: Record<string, MockTable>,
		public readonly migrations = new Set<string>(),
	) {}

	async getTable(name: string): Promise<MockTable | undefined> {
		return this.tables[name];
	}

	async query(sql: string, parameters: unknown[] = []): Promise<Array<{ exists: boolean }>> {
		this.queries.push(sql);
		if (sql.startsWith('SELECT EXISTS')) {
			return [{ exists: this.migrations.has(String(parameters[0])) }];
		}

		const match = sql.match(/^ALTER TABLE "([^"]+)" (ADD|DROP COLUMN) "([^"]+)"/);
		if (match == null) throw new Error(`未対応のSQLです: ${sql}`);

		const [, tableName, operation, columnName] = match;
		const table = this.tables[tableName];
		if (table == null) throw new Error(`${tableName} table が見つかりません`);

		if (operation === 'ADD') {
			table.columns.push({ ...definitions[`${tableName}.${columnName}`] });
		} else {
			table.columns = table.columns.filter(column => column.name !== columnName);
		}

		return [];
	}
}

function column(name: keyof typeof definitions, overrides: Partial<Column> = {}): Column {
	return { ...definitions[name], ...overrides };
}

describe('migration compatibility', () => {
	test('fresh DBでは追加と逆順の削除が完結する', async () => {
		const runner = new MockQueryRunner({
			ad: new MockTable([]),
			note_draft: new MockTable([]),
		});
		const sensitiveAd = new SensitiveAd1757823175259();
		const ioAd = new AddIsSensitiveToAd1765736186185();
		const scheduledPost = new ScheduledPost1758677617888();
		const ioDraft = new NoteDraftIoFields1788353769000();

		await sensitiveAd.up(runner);
		await scheduledPost.up(runner);
		await ioAd.up(runner);
		await ioDraft.up(runner);

		expect(runner.tables.ad.columns.map(item => item.name)).toEqual(['isSensitive', 'imageBlurhash']);
		expect(runner.tables.note_draft.columns.map(item => item.name)).toEqual([
			'scheduledAt',
			'isActuallyScheduled',
			'dimension',
			'lang',
		]);

		await ioDraft.down(runner);
		await ioAd.down(runner);
		await scheduledPost.down(runner);
		await sensitiveAd.down(runner);

		expect(runner.tables.ad.columns).toEqual([]);
		expect(runner.tables.note_draft.columns).toEqual([]);
	});

	test('2025.4 DBのisSensitiveを公式migrationが再利用して保持する', async () => {
		const runner = new MockQueryRunner({
			ad: new MockTable([
				column('ad.isSensitive'),
				column('ad.imageBlurhash'),
			]),
		}, new Set(['AddIsSensitiveToAd1765736186185']));
		const migration = new SensitiveAd1757823175259();

		await migration.up(runner);
		await migration.down(runner);

		expect(runner.tables.ad.findColumnByName('isSensitive')).toEqual(column('ad.isSensitive'));
		expect(runner.queries.some(sql => sql.includes('DROP COLUMN "isSensitive"'))).toBe(false);
	});

	test('2025.9試行DBのscheduledAtを公式migrationが再利用して保持する', async () => {
		const runner = new MockQueryRunner({
			note_draft: new MockTable([
				column('note_draft.scheduledAt'),
				column('note_draft.dimension'),
				column('note_draft.lang'),
			]),
		}, new Set(['NoteDraftIoFields1788353769000']));
		const migration = new ScheduledPost1758677617888();

		await migration.up(runner);
		expect(runner.tables.note_draft.findColumnByName('isActuallyScheduled')).toEqual(column('note_draft.isActuallyScheduled'));
		await migration.down(runner);

		expect(runner.tables.note_draft.findColumnByName('scheduledAt')).toEqual(column('note_draft.scheduledAt'));
		expect(runner.tables.note_draft.findColumnByName('isActuallyScheduled')).toBeUndefined();
		expect(runner.queries.some(sql => sql.includes('DROP COLUMN "scheduledAt"'))).toBe(false);
	});

	test.each([
		['isSensitiveのNULL許可', new SensitiveAd1757823175259(), 'ad', column('ad.isSensitive', { isNullable: true })],
		['imageBlurhashの長さ', new AddIsSensitiveToAd1765736186185(), 'ad', column('ad.imageBlurhash', { length: '64' })],
		['scheduledAtの型', new ScheduledPost1758677617888(), 'note_draft', column('note_draft.scheduledAt', { type: 'timestamp without time zone' })],
		['isActuallyScheduledの既定値', new ScheduledPost1758677617888(), 'note_draft', column('note_draft.isActuallyScheduled', { default: 'true' })],
		['dimensionの既定値', new NoteDraftIoFields1788353769000(), 'note_draft', column('note_draft.dimension', { default: '0' })],
		['langのNULL禁止', new NoteDraftIoFields1788353769000(), 'note_draft', column('note_draft.lang', { isNullable: false })],
	])('%sが異なる既存列を拒否する', async (_label, migration, tableName, existingColumn) => {
		const runner = new MockQueryRunner({
			[tableName]: new MockTable([existingColumn]),
		});

		await expect(migration.up(runner)).rejects.toThrow('定義が不正です');
	});

	test('io migrationは公式所有列を変更しない', async () => {
		const runner = new MockQueryRunner({
			ad: new MockTable([column('ad.isSensitive')]),
			note_draft: new MockTable([
				column('note_draft.scheduledAt'),
				column('note_draft.isActuallyScheduled'),
			]),
		});
		const ioAd = new AddIsSensitiveToAd1765736186185();
		const ioDraft = new NoteDraftIoFields1788353769000();

		await ioAd.up(runner);
		await ioDraft.up(runner);
		await ioDraft.down(runner);
		await ioAd.down(runner);

		expect(runner.tables.ad.columns).toEqual([column('ad.isSensitive')]);
		expect(runner.tables.note_draft.columns).toEqual([
			column('note_draft.scheduledAt'),
			column('note_draft.isActuallyScheduled'),
		]);
	});
});
