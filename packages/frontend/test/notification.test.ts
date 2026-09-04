/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/vue';
import type * as Misskey from 'misskey-js';
import './init.js';
import MkNotification from '@/components/MkNotification.vue';

const signedInUser = vi.hoisted(() => ({ id: 'user-id' }));

vi.mock('@/i.js', () => ({
	$i: signedInUser,
	ensureSignin: () => signedInUser,
}));

vi.mock('@/utility/misskey-api.js', () => ({
	misskeyApi: vi.fn(),
}));

vi.mock('@/components/MkReactionIcon.vue', () => ({ default: {} }));
vi.mock('@/components/MkFollowButton.vue', () => ({ default: {} }));
vi.mock('@/components/MkButton.vue', () => ({ default: {} }));

const notification = {
	id: 'notification-id',
	createdAt: '2026-01-01T00:00:00.000Z',
	type: 'scheduledNoteError',
	draft: {
		id: 'draft-id',
		updatedAt: '2026-01-01T00:00:00.000Z',
		scheduledAt: null,
		reason: 'legacy failure',
		data: {
			text: 'queued note',
			useCw: false,
			cw: null,
			visibility: 'public',
			localOnly: false,
			reactionAcceptance: null,
			files: [],
			poll: null,
		},
	},
} satisfies Extract<Misskey.entities.Notification, { type: 'scheduledNoteError' }>;

describe('MkNotification', () => {
	afterEach(cleanup);

	test('旧予約投稿の失敗内容を表示する', () => {
		const result = render(MkNotification, {
			props: { notification },
			global: {
				stubs: {
					MkAvatar: { template: '<span data-testid="avatar"></span>' },
					Mfm: { props: ['text'], template: '<span>{{ text }}</span>' },
					MkA: true,
					MkTime: true,
					MkUserName: true,
				},
				directives: {
					'user-preview': {},
				},
			},
		});

		expect(result.getByTestId('avatar')).toBeTruthy();
		expect(result.getByText('Scheduled note has problem with posting')).toBeTruthy();
		expect(result.getByText('queued note')).toBeTruthy();
		expect(result.getByText('legacy failure')).toBeTruthy();
		expect(result.container.querySelector('.ti-calendar-exclamation')).not.toBeNull();
	});
});
