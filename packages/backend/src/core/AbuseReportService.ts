/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import RE2 from 're2';
import { In, IsNull, MoreThan } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { AbuseReportResolversRepository, AbuseUserReportsRepository, MiAbuseReportResolver, MiAbuseUserReport, MiUser, UsersRepository } from '@/models/_.js';
import { AbuseReportNotificationService } from '@/core/AbuseReportNotificationService.js';
import { QueueService } from '@/core/QueueService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { SystemAccountService } from '@/core/SystemAccountService.js';
import { IdService } from './IdService.js';

@Injectable()
export class AbuseReportService {
	constructor(
		@Inject(DI.abuseUserReportsRepository)
		private abuseUserReportsRepository: AbuseUserReportsRepository,

		@Inject(DI.abuseReportResolversRepository)
		private abuseReportResolversRepository: AbuseReportResolversRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private idService: IdService,
		private abuseReportNotificationService: AbuseReportNotificationService,
		private queueService: QueueService,
		private systemAccountService: SystemAccountService,
		private apRendererService: ApRendererService,
		private moderationLogService: ModerationLogService,
	) {
	}

	/**
	 * ユーザからの通報をDBに記録し、その内容を下記の手段で管理者各位に通知する.
	 * - 管理者用Redisイベント
	 * - EMail（モデレータ権限所有者ユーザ＋metaテーブルに設定されているメールアドレス）
	 * - SystemWebhook
	 *
	 * @param params 通報内容. もし複数件の通報に対応した時のために、あらかじめ複数件を処理できる前提で考える
	 * @see AbuseReportNotificationService.notify
	 */
	@bindThis
	public async report(params: {
		targetUserId: MiAbuseUserReport['targetUserId'],
		targetUserHost: MiAbuseUserReport['targetUserHost'],
		reporterId: MiAbuseUserReport['reporterId'],
		reporterHost: MiAbuseUserReport['reporterHost'],
		comment: string,
		category?: MiAbuseUserReport['category'],
	}[]) {
		const entities = params.map(param => {
			return {
				id: this.idService.gen(),
				targetUserId: param.targetUserId,
				targetUserHost: param.targetUserHost,
				reporterId: param.reporterId,
				reporterHost: param.reporterHost,
				comment: param.comment,
				category: param.category ?? 'other',
			};
		});

		const reports = Array.of<MiAbuseUserReport>();
		for (const entity of entities) {
			let report = await this.abuseUserReportsRepository.insertOne(entity);
			await this.resolveByResolver(report);
			report = await this.abuseUserReportsRepository.findOneByOrFail({ id: report.id });
			reports.push(report);
		}

		return Promise.all([
			this.abuseReportNotificationService.notifyAdminStream(reports),
			this.abuseReportNotificationService.notifySystemWebhook(reports, 'abuseReport'),
			this.abuseReportNotificationService.notifyMail(reports),
		]);
	}

	/**
	 * 通報を解決し、その内容を下記の手段で管理者各位に通知する.
	 * - SystemWebhook
	 *
	 * @param params 通報内容. もし複数件の通報に対応した時のために、あらかじめ複数件を処理できる前提で考える
	 * @param moderator 通報を処理したユーザ
	 * @see AbuseReportNotificationService.notify
	 */
	@bindThis
	public async resolve(
		params: {
			reportId: string;
			resolvedAs?: MiAbuseUserReport['resolvedAs'];
			forward?: boolean;
		}[],
		moderator: MiUser | null,
	) {
		const paramsMap = new Map(params.map(it => [it.reportId, it]));
		const reports = await this.abuseUserReportsRepository.findBy({
			id: In(params.map(it => it.reportId)),
		});

		for (const report of reports) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const ps = paramsMap.get(report.id)!;

			if (ps.forward === true && report.targetUserHost !== null) await this.forward(report.id, moderator);

			await this.abuseUserReportsRepository.update(report.id, {
				resolved: true,
				assigneeId: moderator?.id ?? null,
				resolvedAs: ps.resolvedAs ?? null,
			});

			if (moderator != null) {
				this.moderationLogService.log(moderator, 'resolveAbuseReport', {
					reportId: report.id,
					report: report,
					forwarded: ps.forward === true && report.targetUserHost != null,
					resolvedAs: ps.resolvedAs ?? null,
				});
			}
		}

		return this.abuseUserReportsRepository.findBy({ id: In(reports.map(it => it.id)) })
			.then(reports => this.abuseReportNotificationService.notifySystemWebhook(reports, 'abuseReportResolved'));
	}

	@bindThis
	public async forward(
		reportId: MiAbuseUserReport['id'],
		moderator: MiUser | null,
	) {
		const report = await this.abuseUserReportsRepository.findOneByOrFail({ id: reportId });

		if (report.targetUserHost == null) {
			throw new Error('The target user host is null.');
		}

		if (report.forwarded) {
			throw new Error('The report has already been forwarded.');
		}

		await this.abuseUserReportsRepository.update(report.id, {
			forwarded: true,
		});

		const actor = await this.systemAccountService.fetch('actor');
		const targetUser = await this.usersRepository.findOneByOrFail({ id: report.targetUserId });

		const flag = this.apRendererService.renderFlag(actor, targetUser.uri!, report.comment);
		const contextAssignedFlag = this.apRendererService.addContext(flag);
		this.queueService.deliver(actor, contextAssignedFlag, targetUser.inbox, false);

		if (moderator != null) {
			this.moderationLogService.log(moderator, 'forwardAbuseReport', {
				reportId: report.id,
				report: report,
			});
		}
	}

	@bindThis
	private async resolveByResolver(report: MiAbuseUserReport): Promise<void> {
		const resolver = await this.findMatchingResolver(report);
		if (resolver == null) return;

		await this.resolve([{ reportId: report.id, forward: resolver.forward, resolvedAs: null }], null);
	}

	@bindThis
	private async findMatchingResolver(report: MiAbuseUserReport): Promise<MiAbuseReportResolver | null> {
		const resolvers = await this.abuseReportResolversRepository.find({
			where: [
				{ expirationDate: MoreThan(new Date()) },
				{ expirationDate: IsNull() },
			],
			order: { createdAt: 'ASC' },
		});

		if (resolvers.length === 0) return null;

		const [targetUser, reporter] = await Promise.all([
			this.usersRepository.findOneBy({ id: report.targetUserId }),
			this.usersRepository.findOneBy({ id: report.reporterId }),
		]);
		const targetUserValue = targetUser == null ? report.targetUserId : this.formatAcct(targetUser);
		const reporterValue = reporter == null ? report.reporterId : this.formatAcct(reporter);

		return resolvers.find(resolver => {
			return this.matchesResolverPattern(resolver.targetUserPattern, targetUserValue)
				&& this.matchesResolverPattern(resolver.reporterPattern, reporterValue)
				&& this.matchesResolverPattern(resolver.reportContentPattern, report.comment);
		}) ?? null;
	}

	@bindThis
	private matchesResolverPattern(pattern: string | null, value: string): boolean {
		if (pattern == null || pattern.length === 0) return true;

		try {
			return new RE2(pattern).test(value);
		} catch (err) {
			if (err instanceof Error) return false;
			throw err;
		}
	}

	@bindThis
	private formatAcct(user: MiUser): string {
		return user.host == null ? `@${user.username}` : `@${user.username}@${user.host}`;
	}

	@bindThis
	public async update(
		reportId: MiAbuseUserReport['id'],
		params: {
			moderationNote?: MiAbuseUserReport['moderationNote'];
		},
		moderator: MiUser,
	) {
		const report = await this.abuseUserReportsRepository.findOneByOrFail({ id: reportId });

		await this.abuseUserReportsRepository.update(report.id, {
			moderationNote: params.moderationNote,
		});

		if (params.moderationNote != null && report.moderationNote !== params.moderationNote) {
			this.moderationLogService.log(moderator, 'updateAbuseReportNote', {
				reportId: report.id,
				report: report,
				before: report.moderationNote,
				after: params.moderationNote,
			});
		}
	}
}
