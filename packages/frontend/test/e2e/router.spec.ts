/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { test } from './fixtures.js';
import { api } from './shared.js';
import {
	// const
	BASE_URL,
	// utils
	resetState, registerUser,
	// page utils
	signIn,
} from './utils.js';

test.describe('Router transition', () => {
	test.beforeAll(async () => {
		await resetState();
		await registerUser('admin', 'pass', true);
		const alice = await registerUser('alice', 'alice1234');
		await api(BASE_URL, 'i/registry/set', {
			i: alice.token,
			scope: ['client', 'base'],
			key: 'accountSetupWizard',
			value: -1,
		});
	});

	test.beforeEach(async ({ page }) => {
		await signIn(page, 'alice', 'alice1234');
		await test.expect(page.getByTestId('signin')).toHaveCount(0);
	});

	test.describe('Redirect', () => {
		test('redirect to user profile', async ({ page }) => {
			await page.goto(`${BASE_URL}/redirect-test`);
			await page.waitForURL('**/@alice');
		});
	});
});
