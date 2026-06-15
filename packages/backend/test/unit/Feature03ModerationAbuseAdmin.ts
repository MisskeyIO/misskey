/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import type {
	AbuseReportResolversRepository,
	AbuseUserReportsRepository,
	MiAbuseReportResolver,
	MiAbuseUserReport,
	MiUserAccountMoveLog,
	UserAccountMoveLogsRepository,
	UserProfilesRepository,
	UsersRepository,
} from '@/models/_.js';
import type { MiLocalUser } from '@/models/User.js';
import { MiUserProfile, type UserProfileMutualLinkSection } from '@/models/UserProfile.js';
import { AbuseReportNotificationService } from '@/core/AbuseReportNotificationService.js';
import { AbuseReportService } from '@/core/AbuseReportService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { IdService } from '@/core/IdService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { QueueService } from '@/core/QueueService.js';
import { QueryService } from '@/core/QueryService.js';
import { SystemAccountService } from '@/core/SystemAccountService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserAccountMoveLogEntityService } from '@/core/entities/UserAccountMoveLogEntityService.js';
import RegenerateUserTokenEndpoint from '@/server/api/endpoints/admin/regenerate-user-token.js';
import ShowUserAccountMoveLogsEndpoint from '@/server/api/endpoints/admin/show-user-account-move-logs.js';
import UnsetUserMutualLinkEndpoint from '@/server/api/endpoints/admin/unset-user-mutual-link.js';
import UpdateUserNameEndpoint from '@/server/api/endpoints/admin/update-user-name.js';
import { MiUser } from '@/models/User.js';

const tokenMocks = vi.hoisted(() => ({
	generateNativeUserToken: vi.fn(() => 'newToken0000000'),
}));

vi.mock('@/misc/token.js', () => ({
	generateNativeUserToken: tokenMocks.generateNativeUserToken,
}));

type ReportInsertInput = Pick<MiAbuseUserReport, 'id' | 'targetUserId' | 'targetUserHost' | 'reporterId' | 'reporterHost' | 'comment'> & Partial<MiAbuseUserReport>;

function createUser(data: Partial<MiUser> = {}): MiUser {
	return new MiUser({
		id: 'user1',
		username: 'user1',
		usernameLower: 'user1',
		name: null,
		host: null,
		uri: null,
		inbox: null,
		token: null,
		...data,
	});
}

function createLocalUser(data: Partial<MiUser> = {}): MiLocalUser {
	return createUser({
		id: 'moderator',
		username: 'moderator',
		usernameLower: 'moderator',
		host: null,
		uri: null,
		...data,
	}) as MiLocalUser;
}

function createReport(data: Partial<MiAbuseUserReport> = {}): MiAbuseUserReport {
	return {
		id: 'report1',
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		targetUserId: 'target',
		targetUser: null,
		reporterId: 'reporter',
		reporter: null,
		assigneeId: null,
		assignee: null,
		resolved: false,
		forwarded: false,
		comment: 'reported content',
		category: 'other',
		moderationNote: '',
		resolvedAs: null,
		targetUserHost: null,
		reporterHost: null,
		...data,
	};
}

function createResolver(data: Partial<MiAbuseReportResolver> = {}): MiAbuseReportResolver {
	return {
		id: 'resolver1',
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		updatedAt: new Date('2026-01-01T00:00:00.000Z'),
		name: 'resolver',
		targetUserPattern: null,
		reporterPattern: null,
		reportContentPattern: null,
		expirationDate: null,
		expiresAt: 'indefinitely',
		forward: false,
		...data,
	};
}

function createAbuseReportServiceFixture() {
	const reports = new Map<string, MiAbuseUserReport>();
	const users = new Map<string, MiUser>();
	const resolvers: MiAbuseReportResolver[] = [];

	const abuseUserReportsRepository = {
		insertOne: vi.fn(async (entity: ReportInsertInput) => {
			const report = createReport(entity);
			reports.set(report.id, report);
			return report;
		}),
		findOneByOrFail: vi.fn(async (query: { id: string }) => {
			const report = reports.get(query.id);
			if (report == null) throw new Error('report not found');
			return report;
		}),
		findBy: vi.fn(async () => [...reports.values()]),
		update: vi.fn(async (id: string, values: Partial<MiAbuseUserReport>) => {
			const report = reports.get(id);
			if (report != null) reports.set(id, { ...report, ...values });
		}),
	};
	const abuseReportResolversRepository = {
		find: vi.fn(async () => resolvers),
	};
	const usersRepository = {
		findOneBy: vi.fn(async (query: { id?: string }) => query.id == null ? null : users.get(query.id) ?? null),
		findOneByOrFail: vi.fn(async (query: { id: string }) => {
			const user = users.get(query.id);
			if (user == null) throw new Error('user not found');
			return user;
		}),
	};
	const idService = {
		gen: vi.fn(() => 'report1'),
	};
	const abuseReportNotificationService = {
		notifyAdminStream: vi.fn(async () => undefined),
		notifySystemWebhook: vi.fn(async () => undefined),
		notifyMail: vi.fn(async () => undefined),
	};
	const queueService = {
		deliver: vi.fn(),
	};
	const systemAccountService = {
		fetch: vi.fn(async () => createLocalUser({ id: 'actor', username: 'actor', usernameLower: 'actor' })),
	};
	const apRendererService = {
		renderFlag: vi.fn(() => ({ type: 'Flag' })),
		addContext: vi.fn((activity: { type: string }) => ({ ...activity, '@context': 'https://www.w3.org/ns/activitystreams' })),
	};
	const moderationLogService = {
		log: vi.fn(),
	};

	const service = new AbuseReportService(
		abuseUserReportsRepository as unknown as AbuseUserReportsRepository,
		abuseReportResolversRepository as unknown as AbuseReportResolversRepository,
		usersRepository as unknown as UsersRepository,
		idService as unknown as IdService,
		abuseReportNotificationService as unknown as AbuseReportNotificationService,
		queueService as unknown as QueueService,
		systemAccountService as unknown as SystemAccountService,
		apRendererService as unknown as ApRendererService,
		moderationLogService as unknown as ModerationLogService,
	);

	return {
		service,
		reports,
		users,
		resolvers,
		abuseUserReportsRepository,
		abuseReportResolversRepository,
		usersRepository,
		idService,
		abuseReportNotificationService,
		queueService,
		systemAccountService,
		apRendererService,
		moderationLogService,
	};
}

describe('Feature 03 moderation abuse admin backend contracts', () => {
	describe('AbuseReportService', () => {
		test('persists the requested abuse report category and notifies with the stored report', async () => {
			const fixture = createAbuseReportServiceFixture();
			fixture.users.set('target', createUser({ id: 'target', username: 'target', usernameLower: 'target' }));
			fixture.users.set('reporter', createUser({ id: 'reporter', username: 'reporter', usernameLower: 'reporter' }));

			await fixture.service.report([{ targetUserId: 'target', targetUserHost: null, reporterId: 'reporter', reporterHost: null, comment: 'spam report', category: 'spam' }]);

			expect(fixture.abuseUserReportsRepository.insertOne).toHaveBeenCalledWith(expect.objectContaining({
				id: 'report1',
				category: 'spam',
				comment: 'spam report',
			}));
			expect(fixture.abuseReportNotificationService.notifyAdminStream).toHaveBeenCalledWith([
				expect.objectContaining({ id: 'report1', category: 'spam', resolved: false }),
			]);
		});

		test('auto-resolves a resolver match and forwards a remote target report', async () => {
			const fixture = createAbuseReportServiceFixture();
			const targetUser = createUser({ id: 'target', username: 'target', usernameLower: 'target', host: 'remote.test', uri: 'https://remote.test/users/target', inbox: 'https://remote.test/inbox' });
			const reporter = createUser({ id: 'reporter', username: 'reporter', usernameLower: 'reporter' });
			fixture.users.set(targetUser.id, targetUser);
			fixture.users.set(reporter.id, reporter);
			fixture.resolvers.push(createResolver({
				targetUserPattern: '^@target@remote\\.test$',
				reporterPattern: '^@reporter$',
				reportContentPattern: 'spam',
				forward: true,
			}));

			await fixture.service.report([{ targetUserId: targetUser.id, targetUserHost: targetUser.host, reporterId: reporter.id, reporterHost: null, comment: 'spam wave', category: 'harassment' }]);

			expect(fixture.abuseUserReportsRepository.update).toHaveBeenCalledWith('report1', { forwarded: true });
			expect(fixture.abuseUserReportsRepository.update).toHaveBeenCalledWith('report1', { resolved: true, assigneeId: null, resolvedAs: null });
			expect(fixture.apRendererService.renderFlag).toHaveBeenCalledWith(expect.objectContaining({ id: 'actor' }), targetUser.uri, 'spam wave');
			expect(fixture.queueService.deliver).toHaveBeenCalledWith(expect.objectContaining({ id: 'actor' }), expect.objectContaining({ type: 'Flag' }), targetUser.inbox, false);
			expect(fixture.reports.get('report1')).toMatchObject({ resolved: true, forwarded: true, category: 'harassment' });
		});
	});

	describe('admin/regenerate-user-token', () => {
		test('regenerates the native token, publishes both events, and records a moderation log', async () => {
			tokenMocks.generateNativeUserToken.mockClear();
			const moderator = createLocalUser();
			const target = createUser({ id: 'target', username: 'target', usernameLower: 'target', token: 'oldToken0000000' });
			const usersRepository = {
				findOneBy: vi.fn(async () => target),
				update: vi.fn(async () => undefined),
			};
			const globalEventService = {
				publishInternalEvent: vi.fn(),
				publishMainStream: vi.fn(),
			};
			const moderationLogService = {
				log: vi.fn(),
			};
			const endpoint = new RegenerateUserTokenEndpoint(
				usersRepository as unknown as UsersRepository,
				globalEventService as unknown as GlobalEventService,
				moderationLogService as unknown as ModerationLogService,
			);

			await endpoint.exec({ userId: target.id }, moderator, null);

			expect(usersRepository.update).toHaveBeenCalledWith(target.id, { token: 'newToken0000000' });
			expect(globalEventService.publishInternalEvent).toHaveBeenCalledWith('userTokenRegenerated', { id: target.id, oldToken: 'oldToken0000000', newToken: 'newToken0000000' });
			expect(globalEventService.publishMainStream).toHaveBeenCalledWith(target.id, 'myTokenRegenerated');
			expect(moderationLogService.log).toHaveBeenCalledWith(moderator, 'regenerateUserToken', expect.objectContaining({ userId: target.id, userUsername: target.username }));
		});
	});

	describe('admin/update-user-name', () => {
		test('validates and updates a display name while logging before and after values', async () => {
			const moderator = createLocalUser();
			const target = createUser({ id: 'target', username: 'target', usernameLower: 'target', name: 'Before' });
			const usersRepository = {
				findOneBy: vi.fn(async () => target),
				update: vi.fn(async () => undefined),
			};
			const userEntityService = {
				validateName: vi.fn(() => true),
			};
			const moderationLogService = {
				log: vi.fn(),
			};
			const endpoint = new UpdateUserNameEndpoint(
				usersRepository as unknown as UsersRepository,
				userEntityService as unknown as UserEntityService,
				moderationLogService as unknown as ModerationLogService,
			);

			await endpoint.exec({ userId: target.id, name: 'After' }, moderator, null);

			expect(userEntityService.validateName).toHaveBeenCalledWith('After');
			expect(usersRepository.update).toHaveBeenCalledWith(target.id, { name: 'After' });
			expect(moderationLogService.log).toHaveBeenCalledWith(moderator, 'updateUserName', expect.objectContaining({ before: 'Before', after: 'After' }));
		});
	});

	describe('admin/unset-user-mutual-link', () => {
		test('removes the selected mutual link and logs the original section state', async () => {
			const moderator = createLocalUser();
			const target = createUser({ id: 'target', username: 'target', usernameLower: 'target' });
			const originalSections: UserProfileMutualLinkSection[] = [{
				id: 'section1',
				name: 'Links',
				mutualLinks: [
					{ id: 'keep', name: 'Keep', url: 'https://example.com/keep' },
					{ id: 'remove', name: 'Remove', url: 'https://example.com/remove' },
				],
			}];
			const userProfile = new MiUserProfile({
				userId: target.id,
				mutualLinkSections: structuredClone(originalSections),
			});
			const usersRepository = {
				findOneBy: vi.fn(async () => target),
			};
			const userProfilesRepository = {
				findOneBy: vi.fn(async () => userProfile),
				save: vi.fn(async (profile: MiUserProfile) => profile),
			};
			const moderationLogService = {
				log: vi.fn(),
			};
			const endpoint = new UnsetUserMutualLinkEndpoint(
				usersRepository as unknown as UsersRepository,
				userProfilesRepository as unknown as UserProfilesRepository,
				moderationLogService as unknown as ModerationLogService,
			);

			await endpoint.exec({ userId: target.id, itemId: 'remove' }, moderator, null);

			expect(userProfilesRepository.save).toHaveBeenCalledWith(expect.objectContaining({
				mutualLinkSections: [{ id: 'section1', name: 'Links', mutualLinks: [{ id: 'keep', name: 'Keep', url: 'https://example.com/keep' }] }],
			}));
			expect(moderationLogService.log).toHaveBeenCalledWith(moderator, 'unsetUserMutualLink', expect.objectContaining({
				userId: target.id,
				userMutualLinkSections: originalSections,
			}));
		});
	});

	describe('admin/show-user-account-move-logs', () => {
		test('applies id and origin filters before packing the account move logs', async () => {
			const moderator = createLocalUser();
			const moveLog: MiUserAccountMoveLog = {
				id: 'log1',
				movedFromId: 'fromid',
				movedFrom: null,
				movedToId: 'toid',
				movedTo: null,
				createdAt: new Date('2026-01-01T00:00:00.000Z'),
			};
			const queryBuilder = {
				andWhere: vi.fn(),
				innerJoin: vi.fn(),
				limit: vi.fn(),
				getMany: vi.fn(async () => [moveLog]),
			};
			queryBuilder.andWhere.mockReturnValue(queryBuilder);
			queryBuilder.innerJoin.mockReturnValue(queryBuilder);
			queryBuilder.limit.mockReturnValue(queryBuilder);
			const userAccountMoveLogsRepository = {
				createQueryBuilder: vi.fn(() => queryBuilder),
			};
			const userAccountMoveLogEntityService = {
				packMany: vi.fn(async () => [{ id: moveLog.id }]),
			};
			const queryService = {
				makePaginationQuery: vi.fn(() => queryBuilder),
			};
			const endpoint = new ShowUserAccountMoveLogsEndpoint(
				userAccountMoveLogsRepository as unknown as UserAccountMoveLogsRepository,
				userAccountMoveLogEntityService as unknown as UserAccountMoveLogEntityService,
				queryService as unknown as QueryService,
			);

			const result = await endpoint.exec({ limit: 25, movedFromId: 'fromid', movedToId: 'toid', from: 'local', to: 'remote' }, moderator, null);

			expect(userAccountMoveLogsRepository.createQueryBuilder).toHaveBeenCalledWith('accountMoveLog');
			expect(queryService.makePaginationQuery).toHaveBeenCalledWith(queryBuilder, undefined, undefined);
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('accountMoveLog.movedFromId = :movedFromId', { movedFromId: 'fromid' });
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('accountMoveLog.movedToId = :movedToId', { movedToId: 'toid' });
			expect(queryBuilder.innerJoin).toHaveBeenCalledWith('accountMoveLog.movedFrom', 'movedFrom');
			expect(queryBuilder.innerJoin).toHaveBeenCalledWith('accountMoveLog.movedTo', 'movedTo');
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('movedFrom.host IS NULL');
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('movedTo.host IS NOT NULL');
			expect(queryBuilder.limit).toHaveBeenCalledWith(25);
			expect(userAccountMoveLogEntityService.packMany).toHaveBeenCalledWith([moveLog], moderator);
			expect(result).toEqual([{ id: moveLog.id }]);
		});
	});
});
