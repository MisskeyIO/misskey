/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

function readSource(path: string): string {
	return readFileSync(resolve(process.cwd(), path), 'utf-8');
}

describe('chat Direct Message surface', () => {
	test('router preserves chat URLs and loads DM-backed chat pages', () => {
		const source = readSource('src/router.definition.ts');

		expect(source).toContain("path: '/chat'");
		expect(source).toContain("@/pages/chat/home.vue");
		expect(source).toContain("@/pages/chat/room.vue");
	});

	test('navigation and user menus preserve chat entry points and compose specified notes', () => {
		const navbar = readSource('src/navbar.ts');
		const userMenu = readSource('src/utility/get-user-menu.ts');

		expect(navbar).toContain("to: '/chat'");
		expect(navbar).not.toContain('hasUnreadChatMessages');
		expect(userMenu).toContain("'/chat/user/:userId'");
		expect(userMenu).toContain('specified: user');
	});

	test('active frontend chat surfaces use specified notes instead of chat APIs', () => {
		const activeSources = [
			'src/boot/main-boot.ts',
			'src/navbar.ts',
			'src/utility/get-user-menu.ts',
			'src/ui/deck.vue',
			'src/ui/deck/chat-column.vue',
			'src/widgets/index.ts',
			'src/widgets/WidgetChat.vue',
			'src/components/MkChatHistories.vue',
			'src/pages/chat/home.vue',
			'src/pages/chat/home.home.vue',
			'src/pages/chat/room.vue',
			'src/pages/chat/room.form.vue',
			'src/pages/chat/room.search.vue',
			'src/pages/chat/message.vue',
			'src/pages/admin-file.root.vue',
			'src/pages/admin-file.chat.vue',
			'src/pages/settings/other.vue',
			'src/pages/settings/preferences.vue',
			'src/pages/settings/privacy.vue',
			'src/pages/admin/roles.policy-editor.vue',
		].map(readSource).join('\n');

		expect(activeSources).not.toMatch(/misskeyApi\('chat\//);
		expect(activeSources).not.toMatch(/os\.apiWithDialog\('chat\//);
		expect(activeSources).not.toContain('newChatMessage');
		expect(activeSources).not.toContain('drive/files/attached-chat-messages');
		expect(activeSources).toContain("new Paginator('notes/mentions'");
		expect(activeSources).toContain("visibility: 'specified'");
		expect(activeSources).toContain('visibleUserIds?.includes(props.userId)');
		expect(activeSources).toContain('specified: user.value');
	});

	test('backend keeps chat endpoints but gates execution with HTTP 451', () => {
		const apiCallService = readSource('../backend/src/server/api/ApiCallService.ts');
		const endpointList = readSource('../backend/src/server/api/endpoint-list.ts');

		expect(endpointList).toContain("export * as 'chat/messages/create-to-user'");
		expect(endpointList).toContain("export * as 'chat/read-all'");
		expect(apiCallService).toContain("endpointName.startsWith('chat/')");
		expect(apiCallService).toContain("endpointName === 'drive/files/attached-chat-messages'");
		expect(apiCallService).toContain('CHAT_UNAVAILABLE_FOR_LEGAL_REASONS');
		expect(apiCallService).toContain('httpStatusCode: 451');
	});
});
