/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import * as migrationModule from '../../migration/1788391179000-migrate-legacy-scheduled-notes.js';

const { MigrateLegacyScheduledNotes1788391179000 } = migrationModule;
const convertLegacyScheduledNote = MigrateLegacyScheduledNotes1788391179000.convertLegacyScheduledNote;

type Column = {
	name: string;
	type: string;
	isNullable: boolean;
	length?: string;
	default?: unknown;
};

class MockTable {
	constructor(public columns: Column[]) {}

	public findColumnByName(name: string): Column | undefined {
		return this.columns.find(column => column.name === name);
	}
}

type LegacyRow = {
	id: string;
	createdAt: Date;
	scheduledAt: Date | null;
	reason: string | null;
	userId: string;
	draft: Record<string, unknown>;
};

function legacyRow(overrides: Partial<LegacyRow> = {}): LegacyRow {
	const createdAt = new Date('2026-01-01T00:00:00.000Z');
	const scheduledAt = new Date('2027-01-01T00:00:00.000Z');
	return {
		id: 'legacy-draft-1',
		createdAt,
		scheduledAt,
		reason: null,
		userId: 'author-1',
		draft: {
			createdAt: createdAt.toISOString(),
			scheduledAt: scheduledAt.toISOString(),
			text: null,
			cw: null,
			files: [],
			localOnly: true,
			dimension: 2,
			reactionAcceptance: null,
			visibility: 'home',
			visibleUsers: [],
			reply: null,
			renote: null,
			channel: null,
			apMentions: [],
			apHashtags: [],
			apEmojis: [],
			lang: 'ja',
		},
		...overrides,
	};
}

const migrationColumns: Column[] = [
	{ name: 'scheduledFailureReason', type: 'character varying', length: '256', isNullable: true },
	{ name: 'noExtractMentions', type: 'boolean', isNullable: false, default: 'false' },
	{ name: 'noExtractHashtags', type: 'boolean', isNullable: false, default: 'false' },
	{ name: 'noExtractEmojis', type: 'boolean', isNullable: false, default: 'false' },
	{ name: 'reservedNoteId', type: 'character varying', length: '32', isNullable: true },
];

const existingDraftColumns: Column[] = [
	{ name: 'scheduledAt', type: 'timestamp with time zone', isNullable: true },
	{ name: 'isActuallyScheduled', type: 'boolean', isNullable: false, default: 'false' },
	{ name: 'dimension', type: 'integer', isNullable: true },
	{ name: 'lang', type: 'character varying', length: '32', isNullable: true },
];

class MockQueryRunner {
	public isTransactionActive = true;
	public readonly queries: Array<{ sql: string; parameters: unknown[] }> = [];
	public readonly tables: Record<string, MockTable | undefined> = {
		note_scheduled: new MockTable([]),
		note_draft: new MockTable(existingDraftColumns.map(column => ({ ...column }))),
		note_scheduled_migration: undefined,
	};
	public readonly sourceRows: LegacyRow[];
	public readonly targetRows = new Map<string, Record<string, unknown>>();
	public readonly ledger = new Map<string, boolean>();
	public users = new Set(['author-1']);

	constructor(rows: LegacyRow[]) {
		this.sourceRows = rows;
	}

	public async getTable(name: string): Promise<MockTable | undefined> {
		return this.tables[name];
	}

	public async query(sql: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> {
		this.queries.push({ sql, parameters });
		const normalized = sql.replace(/\s+/g, ' ').trim();
		if (normalized.startsWith('LOCK TABLE')) return [];
		if (normalized.startsWith('SELECT l."noteScheduledId"') && normalized.includes('WHERE s."id" IS NULL')) return [];

		if (normalized.startsWith('SELECT s."id"') && normalized.includes('FROM "note_scheduled" s')) {
			return this.sourceRows.map(row => ({
				...row,
				migratedId: this.ledger.has(row.id) ? row.id : null,
				wasActive: this.ledger.get(row.id),
			}));
		}
		if (normalized.startsWith('SELECT "id", "createdAt"') && normalized.includes('FROM "note_scheduled"')) return this.sourceRows;
		if (normalized.startsWith('SELECT "id" FROM "note_draft"') && normalized.includes('NOT ("id" = ANY')) return [];
		if (normalized.startsWith('SELECT "id" FROM "note_draft"')) {
			return (parameters[0] as string[]).filter(id => this.targetRows.has(id)).map(id => ({ id }));
		}
		if (normalized.startsWith('SELECT "id", "replyId"') && normalized.includes('FROM "note_draft"')) {
			return (parameters[0] as string[]).map(id => this.targetRows.get(id)).filter(row => row != null) as Record<string, unknown>[];
		}
		if (normalized.startsWith('SELECT "id" FROM "user"')) {
			return (parameters[0] as string[]).filter(id => this.users.has(id)).map(id => ({ id }));
		}
		if (normalized.startsWith('SELECT "id" FROM "note_draft"') && normalized.includes('scheduledFailureReason')) return [];
		if (normalized.startsWith('SELECT "id" FROM "drive_file"') || normalized.startsWith('SELECT "id" FROM "note"') || normalized.startsWith('SELECT "id" FROM "channel"')) return [];

		if (normalized.startsWith('ALTER TABLE "note_draft" ADD')) {
			const name = normalized.match(/ADD "([^"]+)"/)?.[1];
			const column = migrationColumns.find(item => item.name === name);
			if (column == null) throw new Error(`未対応の列です: ${name}`);
			this.tables.note_draft!.columns.push({ ...column });
			return [];
		}
		if (normalized.startsWith('CREATE TABLE "note_scheduled_migration"')) {
			this.tables.note_scheduled_migration = new MockTable([
				{ name: 'noteScheduledId', type: 'character varying', length: '32', isNullable: false },
				{ name: 'wasActive', type: 'boolean', isNullable: false },
			]);
			return [];
		}
		if (normalized.startsWith('INSERT INTO "note_draft"')) {
			for (const id of parameters[0] as string[]) {
				const source = this.sourceRows.find(row => row.id === id)!;
				this.targetRows.set(id, convertLegacyScheduledNote(source));
			}
			return [];
		}
		if (normalized.startsWith('INSERT INTO "note_scheduled_migration"')) {
			for (const id of parameters[0] as string[]) {
				const source = this.sourceRows.find(row => row.id === id)!;
				this.ledger.set(id, source.reason === null);
			}
			return [];
		}
		if (normalized.startsWith('UPDATE "note_scheduled" SET "reason"')) {
			for (const row of this.sourceRows) {
				if ((parameters[0] as string[]).includes(row.id) && row.reason === null) row.reason = String(parameters[1]);
			}
			return [];
		}
		if (normalized.startsWith('DELETE FROM "note_draft"')) {
			for (const id of parameters[0] as string[]) this.targetRows.delete(id);
			return [];
		}
		if (normalized.startsWith('UPDATE "note_scheduled" s SET "reason" = NULL')) {
			for (const row of this.sourceRows) {
				if (this.ledger.get(row.id)) row.reason = null;
			}
			return [];
		}
		if (normalized.includes('FROM "note_scheduled_migration" l')) {
			return [...this.ledger].map(([id, wasActive]) => {
				const source = this.sourceRows.find(row => row.id === id);
				return source == null ? { id: null, migratedId: id, wasActive } : { ...source, migratedId: id, wasActive };
			});
		}
		if (normalized === 'DROP TABLE "note_scheduled_migration"') {
			this.ledger.clear();
			this.tables.note_scheduled_migration = undefined;
			return [];
		}
		if (normalized.startsWith('ALTER TABLE "note_draft" DROP COLUMN')) {
			const name = normalized.match(/DROP COLUMN "([^"]+)"/)?.[1];
			this.tables.note_draft!.columns = this.tables.note_draft!.columns.filter(column => column.name !== name);
			return [];
		}

		throw new Error(`未対応のSQLです: ${normalized}`);
	}

	public writes(): string[] {
		return this.queries.map(query => query.sql.replace(/\s+/g, ' ').trim()).filter(sql => /^(ALTER|CREATE|INSERT|UPDATE|DELETE|DROP) /.test(sql));
	}
}

describe('legacy scheduled note migration', () => {
	test('DataSourceがmigrationとして読み込むexportはup/downを持つclassだけにする', () => {
		expect(Object.keys(migrationModule)).toEqual(['MigrateLegacyScheduledNotes1788391179000']);
		expect(typeof MigrateLegacyScheduledNotes1788391179000.prototype.up).toBe('function');
		expect(typeof MigrateLegacyScheduledNotes1788391179000.prototype.down).toBe('function');
	});

	test('TypeORMの実loaderもmigrationを1件だけ初期化する', async () => {
		const migrationPath = fileURLToPath(new URL('../../migration/1788391179000-migrate-legacy-scheduled-notes.js', import.meta.url));
		const dataSource = new DataSource({
			type: 'postgres',
			database: 'loader-test',
			entities: [],
			migrations: [migrationPath],
			migrationsTransactionMode: 'each',
		});

		await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();

		expect(dataSource.migrations).toHaveLength(1);
		expect(dataSource.migrations[0]).toBeInstanceOf(MigrateLegacyScheduledNotes1788391179000);
	});

	test('2025.4の既知fieldと明示的な抽出抑止をnote_draftへ変換する', () => {
		const converted = convertLegacyScheduledNote(legacyRow());

		expect(converted).toMatchObject({
			id: 'legacy-draft-1',
			userId: 'author-1',
			localOnly: true,
			dimension: 2,
			lang: 'ja',
			visibility: 'home',
			fileIds: [],
			visibleUserIds: [],
			hasPoll: false,
			isActuallyScheduled: true,
			scheduledFailureReason: null,
			noExtractMentions: true,
			noExtractHashtags: true,
			noExtractEmojis: true,
			reservedNoteId: null,
		});
	});

	test('失敗済み予約は失敗理由と元の予約日時を保った非active下書きにする', () => {
		const row = legacyRow({ scheduledAt: null, reason: '保存済みの失敗理由' });
		const converted = convertLegacyScheduledNote(row);

		expect(converted.scheduledAt).toEqual(new Date('2027-01-01T00:00:00.000Z'));
		expect(converted.isActuallyScheduled).toBe(false);
		expect(converted.scheduledFailureReason).toBe('保存済みの失敗理由');
	});

	test('投稿属性と配列順を変えずに変換する', () => {
		const row = legacyRow({
			draft: {
				...legacyRow().draft,
				text: 'fixture',
				cw: 'cw',
				files: [{ id: 'file-2' }, { id: 'file-1' }],
				visibleUsers: [{ id: 'user-2' }, { id: 'user-1' }],
				reply: { id: 'reply-1' },
				renote: { id: 'renote-1' },
				channel: { id: 'channel-1' },
				poll: {
					choices: ['choice-2', 'choice-1'],
					multiple: true,
					expiresAt: '2026-12-31T00:00:00.000Z',
					expiredAfter: 86_400_000,
				},
				reactionAcceptance: 'nonSensitiveOnly',
				visibility: 'specified',
			},
		});

		expect(convertLegacyScheduledNote(row)).toMatchObject({
			text: 'fixture',
			cw: 'cw',
			fileIds: ['file-2', 'file-1'],
			visibleUserIds: ['user-2', 'user-1'],
			replyId: 'reply-1',
			renoteId: 'renote-1',
			channelId: 'channel-1',
			hasPoll: true,
			pollChoices: ['choice-2', 'choice-1'],
			pollMultiple: true,
			pollExpiresAt: new Date('2026-12-31T00:00:00.000Z'),
			pollExpiredAfter: 86_400_000,
			reactionAcceptance: 'nonSensitiveOnly',
			visibility: 'specified',
		});
	});

	test('抽出抑止keyの欠損とnullは通常抽出として扱う', () => {
		const draft = { ...legacyRow().draft };
		delete draft.apMentions;
		draft.apHashtags = null;

		expect(convertLegacyScheduledNote(legacyRow({ draft }))).toMatchObject({
			noExtractMentions: false,
			noExtractHashtags: false,
			noExtractEmojis: true,
		});
	});

	test.each([
		['未知field', () => legacyRow({ draft: { ...legacyRow().draft, unknown: true } }), 'draft.unknown'],
		['activeの予約日時欠損', () => legacyRow({ scheduledAt: null }), 'scheduledAt'],
		['非空apMentions', () => legacyRow({ draft: { ...legacyRow().draft, apMentions: [{}] } }), 'draft.apMentions'],
		['不正poll', () => legacyRow({ draft: { ...legacyRow().draft, poll: { choices: [], multiple: false } } }), 'draft.poll.choices'],
	])('%sを本文なしの日本語エラーで拒否する', (_label, createRow, path) => {
		expect(() => convertLegacyScheduledNote(createRow())).toThrow(path);
	});

	test('検証失敗時はschemaもdataも変更しない', async () => {
		const runner = new MockQueryRunner([legacyRow({ scheduledAt: null })]);
		const migration = new MigrateLegacyScheduledNotes1788391179000();

		await expect(migration.up(runner)).rejects.toThrow('activeなのにありません');
		expect(runner.writes()).toEqual([]);
	});

	test('transaction外ではJSONの読込前に中止する', async () => {
		const runner = new MockQueryRunner([legacyRow()]);
		runner.isTransactionActive = false;
		const migration = new MigrateLegacyScheduledNotes1788391179000();

		await expect(migration.up(runner)).rejects.toThrow('transaction内で実行してください');
		expect(runner.queries).toEqual([]);
	});

	test('変換を一度だけ行い、再実行ではledgerとtargetの一致を確認して終了する', async () => {
		const runner = new MockQueryRunner([legacyRow()]);
		const migration = new MigrateLegacyScheduledNotes1788391179000();

		await migration.up(runner);
		const firstWrites = runner.writes();
		await migration.up(runner);

		expect(runner.targetRows.size).toBe(1);
		expect(runner.ledger.get('legacy-draft-1')).toBe(true);
		expect(runner.sourceRows[0].reason).toBe('__note_draft_migrated__');
		expect(runner.writes()).toEqual(firstWrites);
		expect(runner.tables.note_draft!.columns.slice(0, existingDraftColumns.length)).toEqual(existingDraftColumns);
		const insert = runner.queries.find(query => query.sql.includes('INSERT INTO "note_draft"'))?.sql ?? '';
		expect(insert).toContain('COALESCE(jsonb_typeof');
		for (const fragment of ['{reply,id}', '{renote,id}', "'files'", "'visibleUsers'", '{channel,id}', '{poll,choices}', "'dimension'", "'lang'", "'localOnly'", "'visibility'", "'reactionAcceptance'"]) {
			expect(insert).toContain(fragment);
		}
	});

	test('既存note_draftとのID衝突は全書込前に中止する', async () => {
		const row = legacyRow();
		const runner = new MockQueryRunner([row]);
		runner.targetRows.set(row.id, { id: row.id });
		const migration = new MigrateLegacyScheduledNotes1788391179000();

		await expect(migration.up(runner)).rejects.toThrow('既存行と衝突しています');
		expect(runner.writes()).toEqual([]);
	});

	test('投稿者欠損は全書込前に中止する', async () => {
		const runner = new MockQueryRunner([legacyRow()]);
		runner.users.clear();
		const migration = new MigrateLegacyScheduledNotes1788391179000();

		await expect(migration.up(runner)).rejects.toThrow('userId の参照先がありません');
		expect(runner.writes()).toEqual([]);
	});

	test('削除済みの添付や参照先はIDを失わず個別の投稿処理へ渡す', async () => {
		const row = legacyRow({
			draft: {
				...legacyRow().draft,
				files: [{ id: 'deleted-file' }],
				visibleUsers: [{ id: 'deleted-user' }],
				reply: { id: 'deleted-reply' },
				renote: { id: 'deleted-renote' },
				channel: { id: 'deleted-channel' },
			},
		});
		const runner = new MockQueryRunner([row]);
		const migration = new MigrateLegacyScheduledNotes1788391179000();

		await migration.up(runner);

		expect(runner.targetRows.get(row.id)).toMatchObject({
			fileIds: ['deleted-file'],
			visibleUserIds: ['deleted-user'],
			replyId: 'deleted-reply',
			renoteId: 'deleted-renote',
			channelId: 'deleted-channel',
		});
	});

	test('downは変換後の行が未変更なら旧予約をactiveへ戻す', async () => {
		const runner = new MockQueryRunner([legacyRow()]);
		const migration = new MigrateLegacyScheduledNotes1788391179000();
		await migration.up(runner);

		await migration.down(runner);

		expect(runner.targetRows.size).toBe(0);
		expect(runner.sourceRows[0].reason).toBeNull();
		expect(runner.tables.note_scheduled_migration).toBeUndefined();
		expect(runner.tables.note_draft!.columns).toEqual(existingDraftColumns);
	});

	test('downは変更済みtargetを削除せず中止する', async () => {
		const runner = new MockQueryRunner([legacyRow()]);
		const migration = new MigrateLegacyScheduledNotes1788391179000();
		await migration.up(runner);
		(runner.targetRows.get('legacy-draft-1') as Record<string, unknown>).localOnly = false;
		const writesBeforeDown = runner.writes();

		await expect(migration.down(runner)).rejects.toThrow('note_draft.localOnly が移行時から変更されています');
		expect(runner.writes()).toEqual(writesBeforeDown);
		expect(runner.targetRows.size).toBe(1);
	});
});
