/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// https://vitejs.dev/config/build-options.html#build-modulepreload
import 'vite/modulepreload-polyfill';

import '@/style.scss';
import { mainBoot } from '@/boot/main-boot.js';
import { subBoot } from '@/boot/sub-boot.js';

const subBootPaths = ['/share', '/auth', '/miauth', '/oauth', '/sso', '/signup-complete', '/verify-email', '/install-extensions'];

if (subBootPaths.some(i => window.location.pathname === i || window.location.pathname.startsWith(i + '/'))) {
	subBoot();
} else {
	mainBoot();
}
