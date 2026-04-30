/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, describe, test } from 'vitest';
import { focusTrap } from '@/utility/focus-trap.js';

let releases: (() => void)[] = [];

function createElement(name: string, zIndex: number, interactable = false): HTMLElement {
	const el = document.createElement('div');
	el.dataset.testid = name;
	el.style.position = 'fixed';
	el.style.zIndex = zIndex.toString();
	if (interactable) {
		el.dataset.focusTrapInteractable = '';
	}
	document.body.appendChild(el);
	return el;
}

function trackRelease(release: () => void): () => void {
	releases.push(release);
	return () => {
		release();
		releases = releases.filter(r => r !== release);
	};
}

afterEach(() => {
	for (const release of releases.splice(0).reverse()) {
		release();
	}
	document.body.replaceChildren();
});

describe('focusTrap', () => {
	test('keeps interactable windows active after a higher priority modal closes', () => {
		const page = createElement('page', 0);
		const postFormModal = createElement('postFormModal', 100);
		const emojiPickerWindow = createElement('emojiPickerWindow', 200, true);
		const confirmDialog = createElement('confirmDialog', 300);

		const releasePostFormModal = trackRelease(focusTrap(postFormModal, true).release);
		assert.strictEqual(page.inert, true);
		assert.notStrictEqual(emojiPickerWindow.inert, true);

		const releaseConfirmDialog = trackRelease(focusTrap(confirmDialog, false).release);
		assert.strictEqual(emojiPickerWindow.inert, true);

		releaseConfirmDialog();

		assert.strictEqual(page.inert, true);
		assert.notStrictEqual(postFormModal.inert, true);
		assert.notStrictEqual(emojiPickerWindow.inert, true);

		releasePostFormModal();
	});
});
