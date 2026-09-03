/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, jest, test } from '@jest/globals';
import { MigrateSomeConfigFileSettingsToMeta1746949539915 } from '../../migration/1746949539915-migrateSomeConfigFileSettingsToMeta.js';

class MockQueryRunner {
	public readonly queries: string[] = [];

	constructor(private readonly hasMeta: boolean) {}

	async query(sql: string): Promise<Array<{ hasMeta: boolean }>> {
		this.queries.push(sql);
		if (sql.startsWith('SELECT EXISTS')) return [{ hasMeta: this.hasMeta }];
		return [];
	}
}

describe('config settings migration', () => {
	test.each([
		['稼働済みDBの明示値', true, { proxyRemoteFiles: false, signToActivityPubGet: false, disallowExternalApRedirect: true }, ['false', 'false', 'false']],
		['稼働済みDBの旧既定値', true, {}, ['false', 'true', 'true']],
		['新規DBの公式既定値', false, {}, ['true', 'true', 'true']],
	] as const)('%sを保持する', async (_label, hasMeta, config, expected) => {
		jest.spyOn(MigrateSomeConfigFileSettingsToMeta1746949539915, 'loadCompiledConfig').mockReturnValue(config);
		const runner = new MockQueryRunner(hasMeta);

		await new MigrateSomeConfigFileSettingsToMeta1746949539915().up(runner);

		expect(runner.queries.slice(1)).toEqual([
			`ALTER TABLE "meta" ADD "proxyRemoteFiles" boolean NOT NULL DEFAULT ${expected[0]}`,
			`ALTER TABLE "meta" ADD "signToActivityPubGet" boolean NOT NULL DEFAULT ${expected[1]}`,
			`ALTER TABLE "meta" ADD "allowExternalApRedirect" boolean NOT NULL DEFAULT ${expected[2]}`,
			'ALTER TABLE "meta" ALTER COLUMN "proxyRemoteFiles" SET DEFAULT true',
			'ALTER TABLE "meta" ALTER COLUMN "signToActivityPubGet" SET DEFAULT true',
			'ALTER TABLE "meta" ALTER COLUMN "allowExternalApRedirect" SET DEFAULT true',
		]);
	});
});
