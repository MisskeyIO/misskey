/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Queues } from '@/misc/queues.js';

test.each(['pause', 'resume'] as const)('%sを全キューへ適用し、完了と失敗を呼び出し元へ返す', async (method) => {
	const queues = Array.from({ length: 3 }, () => mock<Queues['queues'][number]>());
	const group = new Queues(queues);
	const pending = Promise.withResolvers<void>();
	for (const queue of queues) queue[method].mockResolvedValue(undefined);
	queues[2][method].mockReturnValueOnce(pending.promise);

	const completed = vi.fn();
	const operation = group[method]().then(completed);
	for (const queue of queues) expect(queue[method]).toHaveBeenCalledOnce();
	await Promise.resolve();
	expect(completed).not.toHaveBeenCalled();
	pending.resolve();
	await operation;
	expect(completed).toHaveBeenCalledOnce();

	const error = new Error('キュー接続エラー');
	queues[0][method].mockRejectedValueOnce(error);
	await expect(group[method]()).rejects.toBe(error);
	for (const queue of queues) expect(queue[method]).toHaveBeenCalledTimes(2);
});
