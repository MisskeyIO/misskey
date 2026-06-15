/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import RE2 from 're2';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { abuseReportResolverExpiresAtValues, type AbuseReportResolverExpiresAt } from '@/models/AbuseReportResolver.js';
import type { AbuseReportResolversRepository, MiAbuseReportResolver } from '@/models/_.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'write:admin:abuse-report-resolvers',

	errors: {
		resolverNotFound: {
			message: 'Resolver not found.',
			id: 'fd32710e-75e1-4d20-bbd2-f89029acb16e',
			code: 'RESOLVER_NOT_FOUND',
		},
		invalidRegularExpressionForTargetUser: {
			message: 'Invalid regular expression for target user.',
			code: 'INVALID_REGULAR_EXPRESSION_FOR_TARGET_USER',
			id: 'c008484a-0a14-4e74-86f4-b176dc49fcaa',
		},
		invalidRegularExpressionForReporter: {
			message: 'Invalid regular expression for reporter.',
			code: 'INVALID_REGULAR_EXPRESSION_FOR_REPORTER',
			id: '399b4062-257f-44c8-87cc-4ffae2527fbc',
		},
		invalidRegularExpressionForReportContent: {
			message: 'Invalid regular expression for report content.',
			code: 'INVALID_REGULAR_EXPRESSION_FOR_REPORT_CONTENT',
			id: '88c124d8-f517-4c63-a464-0abc274168b',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		resolverId: { type: 'string', format: 'misskey:id' },
		name: { type: 'string', minLength: 1, maxLength: 256 },
		targetUserPattern: { type: 'string', nullable: true, maxLength: 1024 },
		reporterPattern: { type: 'string', nullable: true, maxLength: 1024 },
		reportContentPattern: { type: 'string', nullable: true, maxLength: 1024 },
		expiresAt: { type: 'string', enum: abuseReportResolverExpiresAtValues },
		forward: { type: 'boolean' },
	},
	required: ['resolverId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.abuseReportResolversRepository)
		private abuseReportResolversRepository: AbuseReportResolversRepository,
	) {
		super(meta, paramDef, async (ps) => {
			const resolver = await this.abuseReportResolversRepository.findOneBy({ id: ps.resolverId });
			if (resolver == null) throw new ApiError(meta.errors.resolverNotFound);

			const properties: Partial<Omit<MiAbuseReportResolver, 'id'>> = { updatedAt: new Date() };
			if (ps.name !== undefined) properties.name = ps.name;
			if (ps.forward !== undefined) properties.forward = ps.forward;
			if (ps.targetUserPattern !== undefined) {
				validatePattern(ps.targetUserPattern, meta.errors.invalidRegularExpressionForTargetUser);
				properties.targetUserPattern = ps.targetUserPattern;
			}
			if (ps.reporterPattern !== undefined) {
				validatePattern(ps.reporterPattern, meta.errors.invalidRegularExpressionForReporter);
				properties.reporterPattern = ps.reporterPattern;
			}
			if (ps.reportContentPattern !== undefined) {
				validatePattern(ps.reportContentPattern, meta.errors.invalidRegularExpressionForReportContent);
				properties.reportContentPattern = ps.reportContentPattern;
			}
			if (ps.expiresAt !== undefined) {
				properties.expiresAt = ps.expiresAt;
				properties.expirationDate = getExpirationDate(new Date(), ps.expiresAt);
			}

			await this.abuseReportResolversRepository.update(ps.resolverId, properties);
		});
	}
}

type ResolverApiError = typeof meta.errors[keyof typeof meta.errors];

function validatePattern(pattern: string | null, error: ResolverApiError): void {
	if (pattern == null || pattern === '') return;

	try {
		new RE2(pattern);
	} catch (err) {
		if (err instanceof Error) throw new ApiError(error);
		throw err;
	}
}

function getExpirationDate(now: Date, expiresAt: AbuseReportResolverExpiresAt): Date | null {
	if (expiresAt === 'indefinitely') return null;

	const expirationDate = new Date(now);
	switch (expiresAt) {
		case '1hour': expirationDate.setHours(expirationDate.getHours() + 1); break;
		case '12hours': expirationDate.setHours(expirationDate.getHours() + 12); break;
		case '1day': expirationDate.setDate(expirationDate.getDate() + 1); break;
		case '1week': expirationDate.setDate(expirationDate.getDate() + 7); break;
		case '1month': expirationDate.setMonth(expirationDate.getMonth() + 1); break;
		case '3months': expirationDate.setMonth(expirationDate.getMonth() + 3); break;
		case '6months': expirationDate.setMonth(expirationDate.getMonth() + 6); break;
		case '1year': expirationDate.setFullYear(expirationDate.getFullYear() + 1); break;
	}

	return expirationDate;
}
