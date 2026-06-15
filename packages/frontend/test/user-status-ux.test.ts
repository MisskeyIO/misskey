/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import './init';
import { i18n } from '@/i18n.js';
import UserIndex from '@/pages/user/index.vue';

type UsersShowRequest = {
	username: string;
	host: string | null;
};

type NoSuchUserApiError = {
	code: 'NO_SUCH_USER';
	id: string;
	message: string;
	kind: 'client';
	httpStatusCode: 404;
};

type MisskeyApiMock = (endpoint: 'users/show', data: UsersShowRequest) => Promise<never>;

const misskeyApiMock = vi.hoisted(() => vi.fn<MisskeyApiMock>());

vi.mock('@/utility/misskey-api.js', () => ({
	misskeyApi: misskeyApiMock,
}));

const PageWithHeaderStub = defineComponent({
	name: 'PageWithHeader',
	props: {
		tab: { type: String, required: false },
		tabs: { type: Array, required: false },
		actions: { type: Array, required: false },
		swipable: { type: Boolean, required: false },
	},
	emits: ['update:tab'],
	setup(_props, { slots }) {
		return () => h('main', { 'data-testid': 'page-with-header' }, slots.default?.());
	},
});

const MkErrorStub = defineComponent({
	name: 'MkError',
	emits: ['retry'],
	setup() {
		return () => h('button', { 'data-testid': 'generic-retry-error' }, i18n.ts.retry);
	},
});

function renderUserIndex() {
	return render(UserIndex, {
		props: {
			acct: 'missing@example.test',
		},
		global: {
			stubs: {
				PageWithHeader: PageWithHeaderStub,
				MkError: MkErrorStub,
			},
		},
	});
}

describe('user status UX', () => {
	afterEach(() => {
		misskeyApiMock.mockReset();
		cleanup();
	});

	test('renders the dedicated missing-user UI for NO_SUCH_USER responses', async () => {
		const noSuchUserError: NoSuchUserApiError = {
			code: 'NO_SUCH_USER',
			id: '4362f8dc-731f-4ad8-a694-be5a88922a24',
			message: 'No such user.',
			kind: 'client',
			httpStatusCode: 404,
		};
		misskeyApiMock.mockRejectedValueOnce(noSuchUserError);

		renderUserIndex();

		expect(await screen.findByText(i18n.ts.noSuchUser)).toBeTruthy();
		expect(screen.queryByTestId('generic-retry-error')).toBeNull();
		expect(screen.queryByText(i18n.ts.retry)).toBeNull();
		expect(misskeyApiMock).toHaveBeenCalledWith('users/show', {
			username: 'missing',
			host: 'example.test',
		});
	});
});
