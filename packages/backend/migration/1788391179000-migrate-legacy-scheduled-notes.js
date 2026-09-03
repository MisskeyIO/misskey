/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const migrationName = 'MigrateLegacyScheduledNotes1788391179000';
const ledgerTableName = 'note_scheduled_migration';
const activeMarker = '__note_draft_migrated__';

const ownedColumns = {
	scheduledFailureReason: { type: 'character varying', length: '256', isNullable: true, default: null },
	noExtractMentions: { type: 'boolean', isNullable: false, default: false },
	noExtractHashtags: { type: 'boolean', isNullable: false, default: false },
	noExtractEmojis: { type: 'boolean', isNullable: false, default: false },
	reservedNoteId: { type: 'character varying', length: '32', isNullable: true, default: null },
};

const allowedDraftKeys = new Set([
	'createdAt',
	'scheduledAt',
	'name',
	'text',
	'reply',
	'renote',
	'files',
	'poll',
	'localOnly',
	'dimension',
	'reactionAcceptance',
	'cw',
	'visibility',
	'visibleUsers',
	'channel',
	'apMentions',
	'apHashtags',
	'apEmojis',
	'uri',
	'url',
	'app',
	'lang',
]);

const reactionAcceptances = new Set([
	null,
	'likeOnly',
	'likeOnlyForRemote',
	'nonSensitiveOnly',
	'nonSensitiveOnlyForLocalLikeOnlyForRemote',
]);

const visibilities = new Set(['public', 'home', 'followers', 'specified']);

function migrationError(id, path, message) {
	return new Error(`旧予約投稿 ${id}: ${path} ${message}`);
}

function isRecord(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readId(value, id, path) {
	if (typeof value !== 'string' || value.length === 0 || value.length > 32) {
		throw migrationError(id, path, 'のIDが不正です');
	}
	return value;
}

function readNullableString(value, id, path, maxLength = Infinity) {
	if (value == null) return null;
	if (typeof value !== 'string' || value.length > maxLength) {
		throw migrationError(id, path, 'の文字列が不正です');
	}
	return value;
}

function readDate(value, id, path, nullable = true) {
	if (value == null && nullable) return null;
	if (!(value instanceof Date) && typeof value !== 'string') {
		throw migrationError(id, path, 'の日時が不正です');
	}
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw migrationError(id, path, 'の日時が不正です');
	}
	return date;
}

function readRelationId(value, id, path) {
	if (value == null) return null;
	if (!isRecord(value)) throw migrationError(id, path, 'の参照形式が不正です');
	return readId(value.id, id, `${path}.id`);
}

function readRelationIds(value, id, path) {
	if (value == null) return [];
	if (!Array.isArray(value)) throw migrationError(id, path, 'の参照配列が不正です');
	const ids = value.map((item, index) => readRelationId(item, id, `${path}[${index}]`));
	if (ids.some(item => item == null)) throw migrationError(id, path, 'にnull参照があります');
	if (new Set(ids).size !== ids.length) throw migrationError(id, path, 'に重複した参照があります');
	return ids;
}

function readNoExtract(value, id, path) {
	if (value == null) return false;
	if (!Array.isArray(value)) throw migrationError(id, path, 'の形式が不正です');
	if (value.length !== 0) throw migrationError(id, path, 'の非空配列は移行できません');
	return true;
}

function readPoll(value, id) {
	if (value == null) {
		return {
			hasPoll: false,
			pollChoices: [],
			pollMultiple: false,
			pollExpiresAt: null,
			pollExpiredAfter: null,
		};
	}
	if (!isRecord(value)) throw migrationError(id, 'draft.poll', 'の形式が不正です');
	const allowedKeys = new Set(['choices', 'multiple', 'expiresAt', 'expiredAfter']);
	for (const key of Object.keys(value)) {
		if (!allowedKeys.has(key)) throw migrationError(id, `draft.poll.${key}`, 'は未対応です');
	}
	if (!Array.isArray(value.choices) || value.choices.length < 2 || value.choices.length > 10) {
		throw migrationError(id, 'draft.poll.choices', 'の件数が不正です');
	}
	if (new Set(value.choices).size !== value.choices.length || value.choices.some(choice => typeof choice !== 'string' || choice.length === 0 || choice.length > 256)) {
		throw migrationError(id, 'draft.poll.choices', 'の内容が不正です');
	}
	if (typeof value.multiple !== 'boolean') throw migrationError(id, 'draft.poll.multiple', 'がbooleanではありません');
	const expiresAt = readDate(value.expiresAt, id, 'draft.poll.expiresAt');
	const expiredAfter = value.expiredAfter == null ? null : value.expiredAfter;
	if (expiredAfter != null && (!Number.isSafeInteger(expiredAfter) || expiredAfter <= 0)) {
		throw migrationError(id, 'draft.poll.expiredAfter', 'が正の整数ではありません');
	}
	return {
		hasPoll: true,
		pollChoices: value.choices,
		pollMultiple: value.multiple,
		pollExpiresAt: expiresAt,
		pollExpiredAfter: expiredAfter,
	};
}

function convertLegacyScheduledNote(row, wasActive) {
	const id = readId(row.id, '不明', 'id');
	const userId = readId(row.userId, id, 'userId');
	if (!isRecord(row.draft)) throw migrationError(id, 'draft', 'がobjectではありません');
	for (const key of Object.keys(row.draft)) {
		if (!allowedDraftKeys.has(key)) throw migrationError(id, `draft.${key}`, 'は未知のfieldです');
	}

	const sourceWasActive = wasActive ?? row.reason === null;
	if (wasActive === true && row.reason !== activeMarker) throw migrationError(id, 'reason', 'の移行markerが不正です');
	if (wasActive === false && (typeof row.reason !== 'string' || row.reason === activeMarker)) throw migrationError(id, 'reason', 'の失敗理由が不正です');
	if (wasActive == null && row.reason !== null && typeof row.reason !== 'string') throw migrationError(id, 'reason', 'が不正です');
	if (wasActive == null && row.reason === activeMarker) throw migrationError(id, 'reason', 'が予約済みmarkerと衝突しています');

	const createdAt = readDate(row.createdAt, id, 'createdAt', false);
	const draftCreatedAt = readDate(row.draft.createdAt, id, 'draft.createdAt', false);
	if (createdAt.getTime() !== draftCreatedAt.getTime()) throw migrationError(id, 'draft.createdAt', 'が行のcreatedAtと一致しません');

	const scheduledAt = readDate(row.scheduledAt, id, 'scheduledAt');
	const draftScheduledAt = readDate(row.draft.scheduledAt, id, 'draft.scheduledAt', false);
	if (sourceWasActive && scheduledAt == null) throw migrationError(id, 'scheduledAt', 'がactiveなのにありません');
	if (scheduledAt != null && scheduledAt.getTime() !== draftScheduledAt.getTime()) {
		throw migrationError(id, 'draft.scheduledAt', 'が行のscheduledAtと一致しません');
	}

	if (typeof row.draft.localOnly !== 'boolean') throw migrationError(id, 'draft.localOnly', 'がbooleanではありません');
	if (!visibilities.has(row.draft.visibility)) throw migrationError(id, 'draft.visibility', 'が不正です');
	if (row.draft.dimension != null && (!Number.isInteger(row.draft.dimension) || row.draft.dimension < 0 || row.draft.dimension > 2_147_483_647)) {
		throw migrationError(id, 'draft.dimension', 'がintegerの範囲外です');
	}
	if (row.draft.lang != null && (typeof row.draft.lang !== 'string' || row.draft.lang.length > 32)) {
		throw migrationError(id, 'draft.lang', 'が不正です');
	}
	const reactionAcceptance = row.draft.reactionAcceptance ?? null;
	if (!reactionAcceptances.has(reactionAcceptance)) throw migrationError(id, 'draft.reactionAcceptance', 'が不正です');
	for (const key of ['name', 'uri', 'url', 'app']) {
		if (row.draft[key] != null) throw migrationError(id, `draft.${key}`, 'はnote_draftへ移行できません');
	}

	return {
		id,
		replyId: readRelationId(row.draft.reply, id, 'draft.reply'),
		renoteId: readRelationId(row.draft.renote, id, 'draft.renote'),
		text: readNullableString(row.draft.text, id, 'draft.text'),
		cw: readNullableString(row.draft.cw, id, 'draft.cw', 512),
		userId,
		localOnly: row.draft.localOnly,
		dimension: row.draft.dimension ?? null,
		lang: row.draft.lang ?? null,
		reactionAcceptance,
		visibility: row.draft.visibility,
		fileIds: readRelationIds(row.draft.files, id, 'draft.files'),
		visibleUserIds: readRelationIds(row.draft.visibleUsers, id, 'draft.visibleUsers'),
		hashtag: null,
		channelId: readRelationId(row.draft.channel, id, 'draft.channel'),
		...readPoll(row.draft.poll, id),
		scheduledAt: scheduledAt ?? draftScheduledAt,
		isActuallyScheduled: sourceWasActive,
		scheduledFailureReason: sourceWasActive ? null : row.reason,
		noExtractMentions: readNoExtract(row.draft.apMentions, id, 'draft.apMentions'),
		noExtractHashtags: readNoExtract(row.draft.apHashtags, id, 'draft.apHashtags'),
		noExtractEmojis: readNoExtract(row.draft.apEmojis, id, 'draft.apEmojis'),
		reservedNoteId: null,
	};
}

function columnMatches(column, expected) {
	if (column.type !== expected.type || column.isNullable !== expected.isNullable) return false;
	if (expected.length != null && column.length !== expected.length) return false;
	if (expected.default === null && column.default != null) return false;
	if (expected.default != null && ![expected.default, String(expected.default)].includes(column.default)) return false;
	return true;
}

async function inspectSchema(queryRunner) {
	const source = await queryRunner.getTable('note_scheduled');
	const target = await queryRunner.getTable('note_draft');
	const ledger = await queryRunner.getTable(ledgerTableName);
	if (source == null) throw new Error('note_scheduled table が見つかりません');
	if (target == null) throw new Error('note_draft table が見つかりません');

	const columns = Object.entries(ownedColumns).map(([name, expected]) => ({ name, expected, column: target.findColumnByName(name) }));
	const present = columns.filter(item => item.column != null);
	if (present.length === 0 && ledger == null) return { state: 'new', source, target };
	if (present.length !== columns.length || ledger == null) throw new Error(`${migrationName}: migration用schemaが一部だけ存在します`);
	for (const item of columns) {
		if (!columnMatches(item.column, item.expected)) throw new Error(`${migrationName}: note_draft.${item.name} の定義が不正です`);
	}
	const ledgerId = ledger.findColumnByName('noteScheduledId');
	const ledgerWasActive = ledger.findColumnByName('wasActive');
	if (ledgerId == null || ledgerId.type !== 'character varying' || ledgerId.length !== '32' || ledgerId.isNullable) {
		throw new Error(`${migrationName}: ${ledgerTableName}.noteScheduledId の定義が不正です`);
	}
	if (ledgerWasActive == null || ledgerWasActive.type !== 'boolean' || ledgerWasActive.isNullable) {
		throw new Error(`${migrationName}: ${ledgerTableName}.wasActive の定義が不正です`);
	}
	return { state: 'existing', source, target };
}

function unique(values) {
	return [...new Set(values)];
}

async function selectRows(queryRunner, schemaState) {
	if (schemaState === 'new') {
		return await queryRunner.query(`SELECT "id", "createdAt", "scheduledAt", "reason", "userId", "draft" FROM "note_scheduled" ORDER BY "id"`);
	}
	return await queryRunner.query(`
		SELECT s."id", s."createdAt", s."scheduledAt", s."reason", s."userId", s."draft",
			l."noteScheduledId" AS "migratedId", l."wasActive"
		FROM "note_scheduled" s
		LEFT JOIN "${ledgerTableName}" l ON l."noteScheduledId" = s."id"
		ORDER BY s."id"
	`);
}

async function selectTargets(queryRunner, ids, full) {
	if (ids.length === 0) return [];
	if (!full) return await queryRunner.query(`SELECT "id" FROM "note_draft" WHERE "id" = ANY($1::varchar[])`, [ids]);
	return await queryRunner.query(`
		SELECT "id", "replyId", "renoteId", "text", "cw", "userId", "localOnly", "dimension", "lang",
			"reactionAcceptance", "visibility", "fileIds", "visibleUserIds", "hashtag", "channelId", "hasPoll",
			"pollChoices", "pollMultiple", "pollExpiresAt", "pollExpiredAfter", "scheduledAt", "isActuallyScheduled",
			"scheduledFailureReason", "noExtractMentions", "noExtractHashtags", "noExtractEmojis", "reservedNoteId"
		FROM "note_draft"
		WHERE "id" = ANY($1::varchar[])
	`, [ids]);
}

function normalizedValue(key, value) {
	if (key === 'scheduledAt' || key === 'pollExpiresAt') return value == null ? null : new Date(value).getTime();
	if (key === 'pollExpiredAfter') return value == null ? null : String(value);
	return value;
}

function assertSameTarget(expected, actual) {
	if (actual == null) throw migrationError(expected.id, 'note_draft', 'に変換済み行がありません');
	for (const [key, expectedValue] of Object.entries(expected)) {
		const left = normalizedValue(key, expectedValue);
		const right = normalizedValue(key, actual[key]);
		if (Array.isArray(left) ? !Array.isArray(right) || left.length !== right.length || left.some((item, index) => item !== right[index]) : left !== right) {
			throw migrationError(expected.id, `note_draft.${key}`, 'が移行時から変更されています');
		}
	}
}

async function validateAuthors(queryRunner, rows) {
	const userIds = unique(rows.map(row => row.userId));
	const users = userIds.length === 0 ? [] : await queryRunner.query(`SELECT "id" FROM "user" WHERE "id" = ANY($1::varchar[]) FOR KEY SHARE`, [userIds]);
	const foundUsers = new Set(users.map(item => item.id));

	for (const row of rows) {
		if (!foundUsers.has(row.userId)) throw migrationError(row.id, 'userId', 'の参照先がありません');
	}
}

const insertSql = `
	INSERT INTO "note_draft" (
		"id", "replyId", "renoteId", "text", "cw", "userId", "localOnly", "dimension", "lang",
		"reactionAcceptance", "visibility", "fileIds", "visibleUserIds", "hashtag", "channelId", "hasPoll",
		"pollChoices", "pollMultiple", "pollExpiresAt", "pollExpiredAfter", "scheduledAt", "isActuallyScheduled",
		"scheduledFailureReason", "noExtractMentions", "noExtractHashtags", "noExtractEmojis", "reservedNoteId"
	)
	SELECT
		s."id",
		s."draft" #>> '{reply,id}',
		s."draft" #>> '{renote,id}',
		s."draft" ->> 'text',
		s."draft" ->> 'cw',
		s."userId",
		(s."draft" ->> 'localOnly')::boolean,
		(s."draft" ->> 'dimension')::integer,
		s."draft" ->> 'lang',
		s."draft" ->> 'reactionAcceptance',
		(s."draft" ->> 'visibility')::"public"."note_draft_visibility_enum",
		ARRAY(SELECT item.value ->> 'id' FROM jsonb_array_elements(COALESCE(NULLIF(s."draft" -> 'files', 'null'::jsonb), '[]'::jsonb)) WITH ORDINALITY item(value, position) ORDER BY item.position)::varchar(32)[],
		ARRAY(SELECT item.value ->> 'id' FROM jsonb_array_elements(COALESCE(NULLIF(s."draft" -> 'visibleUsers', 'null'::jsonb), '[]'::jsonb)) WITH ORDINALITY item(value, position) ORDER BY item.position)::varchar(32)[],
		NULL,
		s."draft" #>> '{channel,id}',
		COALESCE(jsonb_typeof(s."draft" -> 'poll') = 'object', false),
		ARRAY(SELECT item.value FROM jsonb_array_elements_text(COALESCE(NULLIF(s."draft" #> '{poll,choices}', 'null'::jsonb), '[]'::jsonb)) WITH ORDINALITY item(value, position) ORDER BY item.position)::varchar(256)[],
		COALESCE((s."draft" #>> '{poll,multiple}')::boolean, false),
		(s."draft" #>> '{poll,expiresAt}')::timestamp with time zone,
		(s."draft" #>> '{poll,expiredAfter}')::bigint,
		COALESCE(s."scheduledAt", (s."draft" ->> 'scheduledAt')::timestamp with time zone),
		s."reason" IS NULL,
		s."reason",
		COALESCE(s."draft" -> 'apMentions' = '[]'::jsonb, false),
		COALESCE(s."draft" -> 'apHashtags' = '[]'::jsonb, false),
		COALESCE(s."draft" -> 'apEmojis' = '[]'::jsonb, false),
		NULL
	FROM "note_scheduled" s
	WHERE s."id" = ANY($1::varchar[])
	ORDER BY s."id"
`;

export class MigrateLegacyScheduledNotes1788391179000 {
	name = migrationName
	static convertLegacyScheduledNote = convertLegacyScheduledNote

	async up(queryRunner) {
		if (!queryRunner.isTransactionActive) throw new Error(`${migrationName}: transaction内で実行してください`);
		const schema = await inspectSchema(queryRunner);
		await queryRunner.query(`LOCK TABLE "note_scheduled" IN ACCESS EXCLUSIVE MODE`);
		await queryRunner.query(`LOCK TABLE "note_draft" IN SHARE ROW EXCLUSIVE MODE`);
		if (schema.state === 'existing') {
			await queryRunner.query(`LOCK TABLE "${ledgerTableName}" IN ACCESS EXCLUSIVE MODE`);
			const orphanedLedger = await queryRunner.query(`SELECT l."noteScheduledId" FROM "${ledgerTableName}" l LEFT JOIN "note_scheduled" s ON s."id" = l."noteScheduledId" WHERE s."id" IS NULL LIMIT 1`);
			if (orphanedLedger.length > 0) throw new Error(`${migrationName}: ledgerに対応するnote_scheduled行がありません`);
		}

		const sourceRows = await selectRows(queryRunner, schema.state);
		const converted = sourceRows.map(row => convertLegacyScheduledNote(row, row.migratedId == null ? undefined : row.wasActive));
		const convertedById = new Map(converted.map(row => [row.id, row]));
		const migratedIds = sourceRows.filter(row => row.migratedId != null).map(row => row.id);
		const pending = sourceRows.filter(row => row.migratedId == null).map(row => convertedById.get(row.id));
		const targets = await selectTargets(queryRunner, sourceRows.map(row => row.id), schema.state === 'existing');
		const targetById = new Map(targets.map(row => [row.id, row]));

		for (const id of migratedIds) assertSameTarget(convertedById.get(id), targetById.get(id));
		for (const row of pending) {
			if (targetById.has(row.id)) throw migrationError(row.id, 'note_draft.id', 'が既存行と衝突しています');
		}
		await validateAuthors(queryRunner, pending);

		if (schema.state === 'new') {
			await queryRunner.query(`ALTER TABLE "note_draft" ADD "scheduledFailureReason" character varying(256)`);
			await queryRunner.query(`ALTER TABLE "note_draft" ADD "noExtractMentions" boolean NOT NULL DEFAULT false`);
			await queryRunner.query(`ALTER TABLE "note_draft" ADD "noExtractHashtags" boolean NOT NULL DEFAULT false`);
			await queryRunner.query(`ALTER TABLE "note_draft" ADD "noExtractEmojis" boolean NOT NULL DEFAULT false`);
			await queryRunner.query(`ALTER TABLE "note_draft" ADD "reservedNoteId" character varying(32)`);
			await queryRunner.query(`CREATE TABLE "${ledgerTableName}" ("noteScheduledId" character varying(32) NOT NULL, "wasActive" boolean NOT NULL, CONSTRAINT "PK_note_scheduled_migration" PRIMARY KEY ("noteScheduledId"))`);
		}

		const pendingIds = pending.map(row => row.id);
		if (pendingIds.length === 0) return;
		await queryRunner.query(insertSql, [pendingIds]);
		await queryRunner.query(`INSERT INTO "${ledgerTableName}" ("noteScheduledId", "wasActive") SELECT "id", "reason" IS NULL FROM "note_scheduled" WHERE "id" = ANY($1::varchar[])`, [pendingIds]);
		await queryRunner.query(`UPDATE "note_scheduled" SET "reason" = $2 WHERE "id" = ANY($1::varchar[]) AND "reason" IS NULL`, [pendingIds, activeMarker]);

		const writtenSourceRows = await selectRows(queryRunner, 'existing');
		const writtenSourceById = new Map(writtenSourceRows.map(row => [row.id, row]));
		const writtenTargets = await selectTargets(queryRunner, pendingIds, true);
		const writtenTargetById = new Map(writtenTargets.map(row => [row.id, row]));
		for (const expected of pending) {
			const source = writtenSourceById.get(expected.id);
			if (source?.migratedId == null) throw migrationError(expected.id, ledgerTableName, 'に変換記録がありません');
			convertLegacyScheduledNote(source, source.wasActive);
			assertSameTarget(expected, writtenTargetById.get(expected.id));
		}
	}

	async down(queryRunner) {
		if (!queryRunner.isTransactionActive) throw new Error(`${migrationName}: transaction内で実行してください`);
		const schema = await inspectSchema(queryRunner);
		if (schema.state === 'new') return;
		await queryRunner.query(`LOCK TABLE "note_scheduled" IN ACCESS EXCLUSIVE MODE`);
		await queryRunner.query(`LOCK TABLE "note_draft" IN SHARE ROW EXCLUSIVE MODE`);
		await queryRunner.query(`LOCK TABLE "${ledgerTableName}" IN ACCESS EXCLUSIVE MODE`);

		const sourceRows = await queryRunner.query(`
			SELECT s."id", s."createdAt", s."scheduledAt", s."reason", s."userId", s."draft",
				l."noteScheduledId" AS "migratedId", l."wasActive"
			FROM "${ledgerTableName}" l
			LEFT JOIN "note_scheduled" s ON s."id" = l."noteScheduledId"
			ORDER BY l."noteScheduledId"
		`);
		if (sourceRows.some(row => row.id == null)) throw new Error(`${migrationName}: rollback元のnote_scheduled行がありません`);
		const converted = sourceRows.map(row => convertLegacyScheduledNote(row, row.wasActive));
		const ids = converted.map(row => row.id);
		const targets = await selectTargets(queryRunner, ids, true);
		const targetById = new Map(targets.map(row => [row.id, row]));
		for (const row of converted) assertSameTarget(row, targetById.get(row.id));

		const metadataRows = await queryRunner.query(`
			SELECT "id" FROM "note_draft"
			WHERE NOT ("id" = ANY($1::varchar[]))
				AND ("scheduledFailureReason" IS NOT NULL OR "noExtractMentions" OR "noExtractHashtags" OR "noExtractEmojis" OR "reservedNoteId" IS NOT NULL)
			LIMIT 1
		`, [ids]);
		if (metadataRows.length > 0) throw migrationError(metadataRows[0].id, 'note_draft', 'にrollbackで失われる移行列があります');

		if (ids.length > 0) {
			await queryRunner.query(`DELETE FROM "note_draft" WHERE "id" = ANY($1::varchar[])`, [ids]);
			await queryRunner.query(`UPDATE "note_scheduled" s SET "reason" = NULL FROM "${ledgerTableName}" l WHERE l."noteScheduledId" = s."id" AND l."wasActive"`, []);
		}
		await queryRunner.query(`DROP TABLE "${ledgerTableName}"`);
		await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "reservedNoteId"`);
		await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "noExtractEmojis"`);
		await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "noExtractHashtags"`);
		await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "noExtractMentions"`);
		await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "scheduledFailureReason"`);
	}
}
