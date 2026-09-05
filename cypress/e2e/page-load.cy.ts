/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

describe('配信済み画面の読み込み', () => {
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
		cy.get('[data-cy-signin]', { timeout: 30000 }).should('not.exist');
	});

	// ビルド時の共通部品の欠落を、画面固有の要素で検出する。
	for (const [path, selector] of [
		['/admin/emojis', '.ogwlenmc .local input'],
		['/settings/profile', 'input[max="30"]'],
		['/settings/security', 'img[src="/client-assets/locked_with_key_3d.png"]'],
		['/gallery', 'header .ti-comet'],
	]) {
		it(`${path} が表示される`, () => {
			cy.visit(path);
			cy.get(selector, { timeout: 30000 }).should('be.visible');
		});
	}
});
