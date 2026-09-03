/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

describe('Admin security settings', () => {
	beforeEach(() => {
		cy.resetState();
		cy.registerUser('admin', 'pass', true);

		cy.get('@admin').its('token').then(token => {
			cy.request('POST', '/api/i/registry/set', {
				i: token,
				scope: ['client', 'base'],
				key: 'accountSetupWizard',
				value: -1,
			});
		});

		cy.login('admin', 'pass');
		cy.visit('/admin/security');
	});

	it('shows IndieAuth clients', () => {
		cy.contains('[data-cy-folder-header]', 'IndieAuth Clients').should('be.visible');
	});
});
