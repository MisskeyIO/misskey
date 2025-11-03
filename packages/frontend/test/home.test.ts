/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { vi, afterEach, assert, describe, test } from 'vitest';
import { cleanup, render, type RenderResult } from '@testing-library/vue';
import './init';
import * as Misskey from 'misskey-js';
import { directives } from '@/directives/index.js';
import { components } from '@/components/index.js';
import XHome from '@/pages/user/home.vue';

vi.mock('@/utility/misskey-api.js', () => ({
	misskeyApi: vi.fn().mockResolvedValue({})
}));

vi.mock('@/components/MkChart.vue', () => ({
	default: {
		name: 'MkChart',
		template: '<div></div>'
	}
}));

vi.mock('@/components/MkImgWithBlurhash.vue', () => ({
	default: {
		name: 'MkImgWithBlurhash',
		template: '<div></div>'
	}
}));

describe('XHome', () => {
	const renderHome = (user: Misskey.entities.UserDetailed): RenderResult => {
		return render(XHome, {
			props: { user, disableNotes: true },
			global: { directives, components },
		});
	};

	const userObject = <Misskey.entities.UserDetailed>{
		id: 'blobcat',
		name: 'blobcat',
		username: 'blobcat',
		host: 'example.com',
		avatarUrl: 'https://example.com',
		avatarBlurhash: null,
		avatarDecorations: [],
		emojis: {},
		onlineStatus: 'unknown',
		url: 'https://example.com/@user/profile',
		uri: 'https://example.com/@user',
		movedTo: null,
		alsoKnownAs: null,
		createdAt: '1970-01-01T00:00:00.000Z',
		updatedAt: null,
		lastFetchedAt: null,
		bannerUrl: null,
		bannerBlurhash: null,
		isLocked: false,
		isSilenced: false,
		isLimited: false,
		isSuspended: false,
		description: null,
		location: null,
		birthday: null,
		lang: null,
		fields: [],
		verifiedLinks: [],
		mutualLinkSections: [],
		followersCount: 1,
		followingCount: 2,
		notesCount: 3,
		pinnedNoteIds: [],
		pinnedNotes: [],
		pinnedPageId: null,
		pinnedPage: null,
		publicReactions: true,
		followersVisibility: "public",
		followingVisibility: "public",
		canChat: false,
		roles: [],
		memo: null,
		chatScope: 'none',
	};

	afterEach(() => {
		cleanup();
	});

	// XXX: 変なところでエラーを起こすのでskip
	test('Should render the remote caution when user.host exists', async () => {
		const home = renderHome(userObject);

		const anchor = home.container.querySelector<HTMLAnchorElement>('a[href^="https://example.com/"]');
		assert.exists(anchor, 'anchor to the remote exists');
		assert.strictEqual(anchor?.href, 'https://example.com/@user/profile');
	});

	// XXX: 変なところでエラーを起こすのでskip
	test('The remote caution should fall back to uri if url is null', async () => {
		const home = renderHome({ ...userObject, url: null });

		const anchor = home.container.querySelector<HTMLAnchorElement>('a[href^="https://example.com/"]');
		assert.exists(anchor, 'anchor to the remote exists');
		assert.strictEqual(anchor?.href, 'https://example.com/@user');
	});
});
