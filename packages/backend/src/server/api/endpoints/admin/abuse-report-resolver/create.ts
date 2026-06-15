/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import RE2 from 're2';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { IdService } from '@/core/IdService.js';
import { abuseReportResolverExpiresAtValues, type AbuseReportResolverExpiresAt } from '@/models/AbuseReportResolver.js';
import type { AbuseReportResolversRepository } from '@/models/_.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'write:admin:abuse-report-resolvers',

	res: {
		type: 'object',
		properties: {
			id: { type: 'string', nullable: false, optional: false, format: 'id' },
			createdAt: { type: 'string', nullable: false, optional: false, format: 'date-time' },
			updatedAt: { type: 'string', nullable: false, optional: false, format: 'date-time' },
			name: { type: 'string', nullable: false, optional: false },
			targetUserPattern: { type: 'string', nullable: true, optional: false },
			reporterPattern: { type: 'string', nullable: true, optional: false },
			reportContentPattern: { type: 'string', nullable: true, optional: false },
			expirationDate: { type: 'string', nullable: true, optional: false, format: 'date-time' },
			expiresAt: { type: 'string', nullable: false, optional: false, enum: abuseReportResolverExpiresAtValues },
			forward: { type: 'boolean', nullable: false, optional: false },
		},
	},

	errors: {
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
		name: { type: 'string', minLength: 1, maxLength: 256 },
		targetUserPattern: { type: 'string', nullable: true, maxLength: 1024 },
		reporterPattern: { type: 'string', nullable: true, maxLength: 1024 },
		reportContentPattern: { type: 'string', nullable: true, maxLength: 1024 },
		expiresAt: { type: 'string', enum: abuseReportResolverExpiresAtValues },
		forward: { type: 'boolean' },
	},
	required: ['name', 'targetUserPattern', 'reporterPattern', 'reportContentPattern', 'expiresAt', 'forward'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.abuseReportResolversRepository)
		private abuseReportResolversRepository: AbuseReportResolversRepository,

		private idService: IdService,
	) {
		super(meta, paramDef, async (ps) => {
			validatePattern(ps.targetUserPattern, meta.errors.invalidRegularExpressionForTargetUser);
			validatePattern(ps.reporterPattern, meta.errors.invalidRegularExpressionForReporter);
			validatePattern(ps.reportContentPattern, meta.errors.invalidRegularExpressionForReportContent);

			const now = new Date();
			const resolver = await this.abuseReportResolversRepository.insertOne({
				id: this.idService.gen(now.getTime()),
				createdAt: now,
				updatedAt: now,
				name: ps.name,
				targetUserPattern: ps.targetUserPattern,
				reporterPattern: ps.reporterPattern,
				reportContentPattern: ps.reportContentPattern,
				expirationDate: getExpirationDate(now, ps.expiresAt),
				expiresAt: ps.expiresAt,
				forward: ps.forward,
			});

			return packResolver(resolver);
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

function packResolver(resolver: {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	name: string;
	targetUserPattern: string | null;
	reporterPattern: string | null;
	reportContentPattern: string | null;
	expirationDate: Date | null;
	expiresAt: AbuseReportResolverExpiresAt;
	forward: boolean;
}) {
	return {
		id: resolver.id,
		createdAt: resolver.createdAt.toISOString(),
		updatedAt: resolver.updatedAt.toISOString(),
		name: resolver.name,
		targetUserPattern: resolver.targetUserPattern,
		reporterPattern: resolver.reporterPattern,
		reportContentPattern: resolver.reportContentPattern,
		expirationDate: resolver.expirationDate?.toISOString() ?? null,
		expiresAt: resolver.expiresAt,
		forward: resolver.forward,
	};
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
