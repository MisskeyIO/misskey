/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class BirthdayIndex1767169026317 {
    name = 'BirthdayIndex1767169026317'

    async up(queryRunner) {
        const state = await inspectState(queryRunner);
        if (isCurrentState(state)) return;
        if (!isLegacyState(state)) throw invalidStateError('適用前', state);

        await queryRunner.query(`DROP INDEX "public"."IDX_de22cd2b445eee31ae51cdbe99"`);
        await queryRunner.query(`CREATE OR REPLACE FUNCTION get_birthday_date(birthday TEXT) RETURNS SMALLINT AS $$ BEGIN RETURN CAST((SUBSTR(birthday, 6, 2) || SUBSTR(birthday, 9, 2)) AS SMALLINT); END; $$ LANGUAGE plpgsql IMMUTABLE;`);
        await queryRunner.query(`CREATE INDEX "IDX_USERPROFILE_BIRTHDAY_DATE" ON "user_profile" (get_birthday_date("birthday"))`);

        const migratedState = await inspectState(queryRunner);
        if (!isCurrentState(migratedState)) throw invalidStateError('適用後', migratedState);
    }

    async down(queryRunner) {
        const state = await inspectState(queryRunner);
        if (!isCurrentState(state)) throw invalidStateError('巻き戻し前', state);

        const [{ exists: usedByLegacy }] = await queryRunner.query(
            `SELECT EXISTS (SELECT 1 FROM "migrations" WHERE "name" = $1) AS "exists"`,
            ['BirthdayIndex1711478468155'],
        );
        if (usedByLegacy) return;

        await queryRunner.query(`CREATE INDEX "IDX_de22cd2b445eee31ae51cdbe99" ON "user_profile" (substr("birthday", 6, 5))`);
        await queryRunner.query(`DROP INDEX "public"."IDX_USERPROFILE_BIRTHDAY_DATE"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS get_birthday_date(birthday TEXT)`);

        const revertedState = await inspectState(queryRunner);
        if (!isLegacyState(revertedState)) throw invalidStateError('巻き戻し後', revertedState);
    }
}

const legacyIndexName = 'IDX_de22cd2b445eee31ae51cdbe99';
const currentIndexName = 'IDX_USERPROFILE_BIRTHDAY_DATE';

async function inspectState(queryRunner) {
    const indexes = await queryRunner.query(
        `SELECT
            object_namespace.nspname AS "schemaName",
            object.relname AS "name",
            object.relkind AS "objectType",
            table_namespace.nspname AS "tableSchema",
            indexed_table.relname AS "tableName",
            index_data.indisvalid AS "isValid",
            index_data.indisunique AS "isUnique",
            access_method.amname AS "accessMethod",
            index_data.indnkeyatts AS "keyCount",
            index_data.indnatts AS "attributeCount",
            index_data.indkey::text AS "keyColumns",
            pg_catalog.pg_get_expr(index_data.indexprs, index_data.indrelid) AS "expression",
            pg_catalog.pg_get_expr(index_data.indpred, index_data.indrelid) AS "predicate"
        FROM pg_catalog.pg_class object
        JOIN pg_catalog.pg_namespace object_namespace ON object_namespace.oid = object.relnamespace
        LEFT JOIN pg_catalog.pg_index index_data ON index_data.indexrelid = object.oid
        LEFT JOIN pg_catalog.pg_class indexed_table ON indexed_table.oid = index_data.indrelid
        LEFT JOIN pg_catalog.pg_namespace table_namespace ON table_namespace.oid = indexed_table.relnamespace
        LEFT JOIN pg_catalog.pg_am access_method ON access_method.oid = object.relam
        WHERE object.relname = ANY($1::text[])
        ORDER BY object_namespace.nspname, object.relname`,
        [[legacyIndexName, currentIndexName]],
    );
    const functions = await queryRunner.query(
        `SELECT
            namespace.nspname AS "schemaName",
            procedure.pronargs AS "argumentCount",
            pg_catalog.format_type(procedure.proargtypes[0], NULL) AS "argumentType",
            pg_catalog.format_type(procedure.prorettype, NULL) AS "returnType",
            language.lanname AS "language",
            procedure.provolatile AS "volatility",
            procedure.prokind AS "kind",
            procedure.proretset AS "returnsSet",
            procedure.prosrc AS "body"
        FROM pg_catalog.pg_proc procedure
        JOIN pg_catalog.pg_namespace namespace ON namespace.oid = procedure.pronamespace
        JOIN pg_catalog.pg_language language ON language.oid = procedure.prolang
        WHERE procedure.proname = 'get_birthday_date'
        ORDER BY namespace.nspname, procedure.oid`,
    );
    return { indexes, functions };
}

function isLegacyState({ indexes, functions }) {
    return indexes.length === 1
        && matchesIndex(indexes[0], legacyIndexName, 'substr((birthday)::text,6,5)')
        && functions.length === 0;
}

function isCurrentState({ indexes, functions }) {
    return indexes.length === 1
        && matchesIndex(indexes[0], currentIndexName, 'get_birthday_date((birthday)::text)')
        && functions.length === 1
        && matchesFunction(functions[0]);
}

function matchesIndex(index, name, expression) {
    return index.schemaName === 'public'
        && index.name === name
        && index.objectType === 'i'
        && index.tableSchema === 'public'
        && index.tableName === 'user_profile'
        && index.isValid === true
        && index.isUnique === false
        && index.accessMethod === 'btree'
        && Number(index.keyCount) === 1
        && Number(index.attributeCount) === 1
        && index.keyColumns === '0'
        && normalizeSql(index.expression) === expression
        && index.predicate == null;
}

function matchesFunction(fn) {
    return fn.schemaName === 'public'
        && Number(fn.argumentCount) === 1
        && fn.argumentType === 'text'
        && fn.returnType === 'smallint'
        && fn.language === 'plpgsql'
        && fn.volatility === 'i'
        && fn.kind === 'f'
        && fn.returnsSet === false
        && normalizeSql(fn.body) === 'beginreturncast((substr(birthday,6,2)||substr(birthday,9,2))assmallint);end;';
}

function normalizeSql(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, '').toLowerCase() : '';
}

function invalidStateError(phase, state) {
    return new Error(`誕生日index migrationの${phase}状態が不正です: ${JSON.stringify(state)}`);
}
