/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { initTestDb, sendEnvResetRequest } from './utils.js';

beforeAll(async () => {
	// 前のアプリを停止してからschemaを作り直す。
	await sendEnvResetRequest();
	await initTestDb(false);
});
