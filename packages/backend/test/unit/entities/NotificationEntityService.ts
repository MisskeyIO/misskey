/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, jest, test } from '@jest/globals';
import { EntityNotFoundError } from 'typeorm';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import type { MiNotification } from '@/models/Notification.js';

function createService(packNoteDraft: (_id: string, _me: { id: string }) => Promise<unknown>) {
	const moduleRef = {
		get: jest.fn((name: string) => name === 'NoteDraftEntityService' ? { pack: packNoteDraft } : {}),
	};
	const service = new NotificationEntityService(
		moduleRef as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
	);
	service.onModuleInit();
	return service;
}

const notification: MiNotification = {
	type: 'scheduledNotePostFailed',
	id: 'notification-id',
	createdAt: '2026-01-01T00:00:00.000Z',
	noteDraftId: 'draft-id',
};

describe('NotificationEntityService', () => {
	test('投稿失敗通知へ下書きを含める', async () => {
		const noteDraft = { id: 'draft-id' };
		const packNoteDraft = jest.fn(async (_id: string, _me: { id: string }) => noteDraft);
		const service = createService(packNoteDraft);

		await expect(service.pack(notification, 'user-id', { checkValidNotifier: false })).resolves.toEqual({
			id: notification.id,
			createdAt: notification.createdAt,
			type: notification.type,
			noteDraft,
		});
		expect(packNoteDraft).toHaveBeenCalledWith(notification.noteDraftId, { id: 'user-id' });
	});

	test('削除済み下書きの通知を除外する', async () => {
		const packNoteDraft = jest.fn(async (_id: string, _me: { id: string }) => {
			throw new EntityNotFoundError('NoteDraft', { id: notification.noteDraftId });
		});
		const service = createService(packNoteDraft);

		await expect(service.pack(notification, 'user-id', { checkValidNotifier: false })).resolves.toBeNull();
	});
});
