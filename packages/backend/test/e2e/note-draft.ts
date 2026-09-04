/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'node:assert';
import { setTimeout } from 'node:timers/promises';
import { afterAll, beforeAll, describe, test } from 'vitest';
import type { INestApplicationContext } from '@nestjs/common';
import type * as misskey from 'misskey-js';
import { api, castAsError, sendEnvUpdateRequest, signup, startJobQueue } from '../utils.js';

type IoDraftFields = {
	dimension: number | null;
	lang: string | null;
	scheduledAt: number | null;
};

describe('NoteDraft', () => {
	let queue: INestApplicationContext;
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;

	beforeAll(async () => {
		queue = await startJobQueue();
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await queue.close();
	});

	test('認証なしでは作成できない', async () => {
		const res = await api('notes/drafts/create', { text: 'draft' });

		assert.strictEqual(res.status, 401);
		assert.strictEqual(castAsError(res.body).error.code, 'CREDENTIAL_REQUIRED');
	});

	test('ioの投稿設定を作成・更新できる', async () => {
		const scheduledAt = Math.ceil(Date.now() / 1000) * 1000 + 60_000;
		const createParams: misskey.Endpoints['notes/drafts/create']['req'] = {
			text: 'draft',
			dimension: 0,
			lang: 'ja',
			scheduledAt,
		};
		const createRes = await api('notes/drafts/create', createParams, alice);

		assert.strictEqual(createRes.status, 200);
		const created = createRes.body.createdDraft as typeof createRes.body.createdDraft & IoDraftFields;
		assert.strictEqual(created.dimension, 0);
		assert.strictEqual(created.lang, 'ja');
		assert.strictEqual(created.scheduledAt, scheduledAt);
		assert.strictEqual(created.localOnly, false);

		const updateParams: misskey.Endpoints['notes/drafts/update']['req'] = {
			draftId: created.id,
			text: 'updated',
			localOnly: false,
			dimension: 1000,
			lang: null,
			scheduledAt: null,
		};
		const updateRes = await api('notes/drafts/update', updateParams, alice);

		assert.strictEqual(updateRes.status, 200);
		const updated = updateRes.body.updatedDraft as typeof updateRes.body.updatedDraft & IoDraftFields;
		assert.strictEqual(updated.dimension, 1000);
		assert.strictEqual(updated.lang, null);
		assert.strictEqual(updated.scheduledAt, null);
		assert.strictEqual(updated.localOnly, true);
	});

	test('投票期間は一覧でも数値として返す', async () => {
		const expiredAfter = 86_400_000;
		const createRes = await api('notes/drafts/create', {
			text: 'poll draft',
			poll: {
				choices: ['yes', 'no'],
				expiredAfter,
			},
		}, alice);
		assert.strictEqual(createRes.status, 200);

		const listRes = await api('notes/drafts/list', {}, alice);
		assert.strictEqual(listRes.status, 200);
		const draft = listRes.body.find(item => item.id === createRes.body.createdDraft.id);
		assert.ok(draft);
		assert.strictEqual(draft.poll?.expiredAfter, expiredAfter);
		assert.strictEqual(typeof draft.poll?.expiredAfter, 'number');
	});

	test('他人の下書きは更新・取得できない', async () => {
		const createRes = await api('notes/drafts/create', { text: 'private draft' }, alice);
		assert.strictEqual(createRes.status, 200);

		const updateRes = await api('notes/drafts/update', {
			draftId: createRes.body.createdDraft.id,
			text: 'stolen',
		}, bob);
		assert.strictEqual(updateRes.status, 400);
		assert.strictEqual(castAsError(updateRes.body).error.code, 'NO_SUCH_NOTE_DRAFT');

		const listRes = await api('notes/drafts/list', {}, bob);
		assert.strictEqual(listRes.status, 200);
		assert.ok(!listRes.body.some(draft => draft.id === createRes.body.createdDraft.id));
	});

	test('投稿言語は許可値だけを受け付ける', async () => {
		const params = {
			text: 'draft',
			lang: 'en',
		} as unknown as misskey.Endpoints['notes/drafts/create']['req'];
		const res = await api('notes/drafts/create', params, alice);

		assert.strictEqual(res.status, 400);
	});

	test('DBで扱えない投稿設定を拒否する', async () => {
		const dimensionRes = await api('notes/drafts/create', {
			text: 'draft',
			dimension: 2_147_483_648,
		} as misskey.Endpoints['notes/drafts/create']['req'], alice);
		assert.strictEqual(dimensionRes.status, 400);

		const scheduledAtRes = await api('notes/drafts/create', {
			text: 'draft',
			scheduledAt: 253_402_300_800_000,
		} as misskey.Endpoints['notes/drafts/create']['req'], alice);
		assert.strictEqual(scheduledAtRes.status, 400);
	});

	test('予約投稿から下書きへ戻す値を保持する', async () => {
		const expiredAfter = 86_400_000;
		const createRes = await api('notes/drafts/create', {
			text: 'scheduled draft',
			scheduledAt: Date.now() + 300_000,
			isActuallyScheduled: true,
			reactionAcceptance: 'likeOnly',
			poll: {
				choices: ['yes', 'no'],
				expiredAfter,
			},
		}, alice);
		assert.strictEqual(createRes.status, 200);

		const listRes = await api('notes/drafts/list', { scheduled: true }, alice);
		assert.strictEqual(listRes.status, 200);
		const scheduled = listRes.body.find(item => item.text === 'scheduled draft');
		assert.ok(scheduled);
		assert.strictEqual(scheduled.reactionAcceptance, 'likeOnly');
		assert.strictEqual(scheduled.poll?.expiredAfter, expiredAfter);
	});

	test('Redisの記録に頼らず同じ予約を一件だけ保存する', async () => {
		const params = {
			text: 'idempotent scheduled note',
			scheduledAt: Date.now() + 300_000,
		};

		await sendEnvUpdateRequest({ key: 'FORCE_IGNORE_IDEMPOTENCY_FOR_TESTING', value: 'true' });
		try {
			const results = await Promise.all([
				api('notes/create', params, alice),
				api('notes/create', params, alice),
			]);
			assert.ok(results.every(result => result.status === 204));
		} finally {
			await sendEnvUpdateRequest({ key: 'FORCE_IGNORE_IDEMPOTENCY_FOR_TESTING', value: 'false' });
		}

		const listRes = await api('notes/drafts/list', { scheduled: true }, alice);
		assert.strictEqual(listRes.status, 200);
		assert.strictEqual(listRes.body.filter(item => item.text === params.text).length, 1);
	});

	test('予約投稿の投票期間は実投稿時から数える', async () => {
		const expiredAfter = 60_000;
		const scheduledAt = Math.ceil(Date.now() / 1000) * 1000 + 2000;
		const createRes = await api('notes/drafts/create', {
			text: 'scheduled poll',
			scheduledAt,
			isActuallyScheduled: true,
			poll: {
				choices: ['yes', 'no'],
				expiredAfter,
			},
		}, alice);
		assert.strictEqual(createRes.status, 200);

		let note: misskey.entities.Note | undefined;
		const timeoutAt = Date.now() + 10_000;
		while (Date.now() < timeoutAt) {
			const notesRes = await api('users/notes', { userId: alice.id, limit: 100 }, alice);
			assert.strictEqual(notesRes.status, 200);
			note = notesRes.body.find(item => item.text === 'scheduled poll');
			if (note) break;
			await setTimeout(100);
		}

		assert.ok(note);
		assert.ok(note.poll?.expiresAt);
		assert.ok(new Date(note.poll.expiresAt).getTime() >= scheduledAt + expiredAfter);
	}, 15_000);

	test('予約投稿の投票期限を絶対日時でも保持する', async () => {
		const scheduledAt = Math.ceil(Date.now() / 1000) * 1000 + 2000;
		const expiresAt = scheduledAt + 60_000;
		const createRes = await api('notes/drafts/create', {
			text: 'scheduled poll with deadline',
			scheduledAt,
			isActuallyScheduled: true,
			poll: {
				choices: ['yes', 'no'],
				expiresAt,
			},
		}, alice);
		assert.strictEqual(createRes.status, 200);

		let note: misskey.entities.Note | undefined;
		const timeoutAt = Date.now() + 10_000;
		while (Date.now() < timeoutAt) {
			const notesRes = await api('users/notes', { userId: alice.id, limit: 100 }, alice);
			assert.strictEqual(notesRes.status, 200);
			note = notesRes.body.find(item => item.text === 'scheduled poll with deadline');
			if (note) break;
			await setTimeout(100);
		}

		assert.ok(note);
		assert.ok(note.poll?.expiresAt);
		assert.strictEqual(new Date(note.poll.expiresAt).getTime(), expiresAt);
	}, 15_000);
});
