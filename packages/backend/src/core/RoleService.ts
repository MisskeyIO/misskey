/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { In } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import type {
	MiRole,
	MiRoleAssignment,
	RoleAssignmentsRepository,
	RolesRepository,
	UsersRepository,
} from '@/models/_.js';
import { MemoryKVCache, MemorySingleCache } from '@/misc/cache.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type { MiUser } from '@/models/User.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { MetaService } from '@/core/MetaService.js';
import { CacheService } from '@/core/CacheService.js';
import type { RoleCondFormulaValue } from '@/models/Role.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { IdService } from '@/core/IdService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import type { Packed } from '@/misc/json-schema.js';
import { FanoutTimelineService } from '@/core/FanoutTimelineService.js';
import { NotificationService } from '@/core/NotificationService.js';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

export type RolePolicies = {
	gtlAvailable: boolean;
	ltlAvailable: boolean;
	canPublicNote: boolean;
	canScheduleNote: boolean;
	scheduleNoteLimit: number;
	scheduleNoteMaxDays: number;
	canInitiateConversation: boolean;
	canCreateContent: boolean;
	canUpdateContent: boolean;
	canDeleteContent: boolean;
	canPurgeAccount: boolean;
	canUpdateAvatar: boolean;
	canUpdateBanner: boolean;
	mentionLimit: number;
	canInvite: boolean;
	inviteLimit: number;
	inviteLimitCycle: number;
	inviteExpirationTime: number;
	canManageCustomEmojis: boolean;
	canManageAvatarDecorations: boolean;
	canSearchNotes: boolean;
	canUseTranslator: boolean;
	canUseDriveFileInSoundSettings: boolean;
	canUseReaction: boolean;
	canHideAds: boolean;
	driveCapacityMb: number;
	alwaysMarkNsfw: boolean;
	skipNsfwDetection: boolean;
	pinLimit: number;
	antennaLimit: number;
	antennaNotesLimit: number;
	wordMuteLimit: number;
	webhookLimit: number;
	clipLimit: number;
	noteEachClipsLimit: number;
	userListLimit: number;
	userEachUserListsLimit: number;
	rateLimitFactor: number;
	avatarDecorationLimit: number;
	mutualLinkSectionLimit: number;
	mutualLinkLimit: number;
};

export const DEFAULT_POLICIES: RolePolicies = {
	gtlAvailable: true,
	ltlAvailable: true,
	canPublicNote: true,
	canScheduleNote: true,
	scheduleNoteLimit: 10,
	scheduleNoteMaxDays: 365,
	canInitiateConversation: true,
	canCreateContent: true,
	canUpdateContent: true,
	canDeleteContent: true,
	canPurgeAccount: true,
	canUpdateAvatar: true,
	canUpdateBanner: true,
	mentionLimit: 20,
	canInvite: false,
	inviteLimit: 0,
	inviteLimitCycle: 60 * 24 * 7,
	inviteExpirationTime: 0,
	canManageCustomEmojis: false,
	canManageAvatarDecorations: false,
	canSearchNotes: false,
	canUseTranslator: true,
	canUseDriveFileInSoundSettings: false,
	canUseReaction: true,
	canHideAds: false,
	driveCapacityMb: 100,
	alwaysMarkNsfw: false,
	skipNsfwDetection: false,
	pinLimit: 5,
	antennaLimit: 5,
	antennaNotesLimit: 200,
	wordMuteLimit: 200,
	webhookLimit: 3,
	clipLimit: 10,
	noteEachClipsLimit: 200,
	userListLimit: 10,
	userEachUserListsLimit: 50,
	rateLimitFactor: 1,
	avatarDecorationLimit: 1,
	mutualLinkSectionLimit: 1,
	mutualLinkLimit: 3,
};

@Injectable()
export class RoleService implements OnApplicationShutdown, OnModuleInit {
	private rolesCache: MemorySingleCache<MiRole[]>;
	private roleAssignmentByUserIdCache: MemoryKVCache<MiRoleAssignment[]>;
	private notificationService: NotificationService;

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.redisForTimelines)
		private redisForTimelines: Redis.Redis,

		@Inject(DI.redisForSub)
		private redisForSub: Redis.Redis,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.rolesRepository)
		private rolesRepository: RolesRepository,

		@Inject(DI.roleAssignmentsRepository)
		private roleAssignmentsRepository: RoleAssignmentsRepository,

		private metaService: MetaService,
		private cacheService: CacheService,
		private userEntityService: UserEntityService,
		private globalEventService: GlobalEventService,
		private idService: IdService,
		private moderationLogService: ModerationLogService,
		private fanoutTimelineService: FanoutTimelineService,
	) {
		this.rolesCache = new MemorySingleCache<MiRole[]>(1000 * 60 * 60); // 1h
		this.roleAssignmentByUserIdCache = new MemoryKVCache<MiRoleAssignment[]>(1000 * 60 * 5); // 5m

		this.redisForSub.on('message', this.onMessage);
	}

	async onModuleInit() {
		this.notificationService = this.moduleRef.get(NotificationService.name);
	}

	@bindThis
	private async onMessage(_: string, data: string): Promise<void> {
		const obj = JSON.parse(data);

		if (obj.channel === 'internal') {
			const { type, body } = obj.message as GlobalEvents['internal']['payload'];
			switch (type) {
				case 'roleCreated': {
					const cached = this.rolesCache.get();
					if (cached) {
						cached.push({
							...body,
							createdAt: new Date(body.createdAt),
							updatedAt: new Date(body.updatedAt),
							lastUsedAt: new Date(body.lastUsedAt),
						});
					}
					break;
				}
				case 'roleUpdated': {
					const cached = this.rolesCache.get();
					if (cached) {
						const i = cached.findIndex(x => x.id === body.id);
						if (i > -1) {
							cached[i] = {
								...body,
								createdAt: new Date(body.createdAt),
								updatedAt: new Date(body.updatedAt),
								lastUsedAt: new Date(body.lastUsedAt),
							};
						}
					}
					break;
				}
				case 'roleDeleted': {
					const cached = this.rolesCache.get();
					if (cached) {
						this.rolesCache.set(cached.filter(x => x.id !== body.id));
					}
					break;
				}
				case 'userRoleAssigned': {
					const cached = this.roleAssignmentByUserIdCache.get(body.userId);
					if (cached) {
						cached.push({ // TODO: このあたりのデシリアライズ処理は各modelファイル内に関数としてexportしたい
							...body,
							createdAt: new Date(body.createdAt),
							expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
							user: null, // joinなカラムは通常取ってこないので
							role: null, // joinなカラムは通常取ってこないので
						});
					}
					break;
				}
				case 'userRoleUnassigned': {
					const cached = this.roleAssignmentByUserIdCache.get(body.userId);
					if (cached) {
						this.roleAssignmentByUserIdCache.set(body.userId, cached.filter(x => x.id !== body.id));
					}
					break;
				}
				default:
					break;
			}
		}
	}

	@bindThis
	private evalCond(user: MiUser, roles: MiRole[], value: RoleCondFormulaValue): boolean {
		try {
			switch (value.type) {
				// ～かつ～
				case 'and': {
					return value.values.every(v => this.evalCond(user, roles, v));
				}
				// ～または～
				case 'or': {
					return value.values.some(v => this.evalCond(user, roles, v));
				}
				// ～ではない
				case 'not': {
					return !this.evalCond(user, roles, value.value);
				}
				// マニュアルロールがアサインされている
				case 'roleAssignedTo': {
					return roles.some(r => r.id === value.roleId);
				}
				// ローカルユーザのみ
				case 'isLocal': {
					return this.userEntityService.isLocalUser(user);
				}
				// リモートユーザのみ
				case 'isRemote': {
					return this.userEntityService.isRemoteUser(user);
				}
				// サスペンド済みユーザである
				case 'isSuspended': {
					return user.isSuspended;
				}
				// 鍵アカウントユーザである
				case 'isLocked': {
					return user.isLocked;
				}
				// botユーザである
				case 'isBot': {
					return user.isBot;
				}
				// 猫である
				case 'isCat': {
					return user.isCat;
				}
				// 「ユーザを見つけやすくする」が有効なアカウント
				case 'isExplorable': {
					return user.isExplorable;
				}
				// ユーザが作成されてから指定期間経過した
				case 'createdLessThan': {
					return this.idService.parse(user.id).date.getTime() > (Date.now() - (value.sec * 1000));
				}
				// ユーザが作成されてから指定期間経っていない
				case 'createdMoreThan': {
					return this.idService.parse(user.id).date.getTime() < (Date.now() - (value.sec * 1000));
				}
				// フォロワー数が指定値以下
				case 'followersLessThanOrEq': {
					return user.followersCount <= value.value;
				}
				// フォロワー数が指定値以上
				case 'followersMoreThanOrEq': {
					return user.followersCount >= value.value;
				}
				// フォロー数が指定値以下
				case 'followingLessThanOrEq': {
					return user.followingCount <= value.value;
				}
				// フォロー数が指定値以上
				case 'followingMoreThanOrEq': {
					return user.followingCount >= value.value;
				}
				// ノート数が指定値以下
				case 'notesLessThanOrEq': {
					return user.notesCount <= value.value;
				}
				// ノート数が指定値以上
				case 'notesMoreThanOrEq': {
					return user.notesCount >= value.value;
				}
				default:
					return false;
			}
		} catch (err) {
			// TODO: log error
			return false;
		}
	}

	@bindThis
	public async getRoles() {
		const roles = await this.rolesCache.fetch(() => this.rolesRepository.findBy({}));
		return roles;
	}

	@bindThis
	public async getUserAssigns(userId: MiUser['id']) {
		const now = Date.now();
		let assigns = await this.roleAssignmentByUserIdCache.fetch(userId, () => this.roleAssignmentsRepository.findBy({ userId }));
		// 期限切れのロールを除外
		assigns = assigns.filter(a => a.expiresAt == null || (a.expiresAt.getTime() > now));
		return assigns;
	}

	@bindThis
	public async getUserRoles(userId: MiUser['id']) {
		const roles = await this.rolesCache.fetch(() => this.rolesRepository.findBy({}));
		const assigns = await this.getUserAssigns(userId);
		const assignedRoles = roles.filter(r => assigns.map(x => x.roleId).includes(r.id));
		const user = roles.some(r => r.target === 'conditional') ? await this.cacheService.findUserById(userId) : null;
		const matchedCondRoles = roles.filter(r => r.target === 'conditional' && this.evalCond(user!, assignedRoles, r.condFormula));
		return [...assignedRoles, ...matchedCondRoles];
	}

	/**
	 * 指定ユーザーのバッジロール一覧取得
	 */
	@bindThis
	public async getUserBadgeRoles(userId: MiUser['id'], publicOnly: boolean) {
		const now = Date.now();
		let assigns = await this.roleAssignmentByUserIdCache.fetch(userId, () => this.roleAssignmentsRepository.findBy({ userId }));
		// 期限切れのロールを除外
		assigns = assigns.filter(a => a.expiresAt == null || (a.expiresAt.getTime() > now));
		const roles = await this.rolesCache.fetch(() => this.rolesRepository.findBy({}));
		const assignedRoles = roles.filter(r => assigns.map(x => x.roleId).includes(r.id));
		const assignedBadgeRoles = assignedRoles.filter(r => r.asBadge);
		const badgeCondRoles = roles.filter(r => r.asBadge && (r.target === 'conditional'));
		if (badgeCondRoles.length > 0) {
			const user = roles.some(r => r.target === 'conditional') ? await this.cacheService.findUserById(userId) : null;
			const matchedBadgeCondRoles = badgeCondRoles.filter(r => this.evalCond(user!, assignedRoles, r.condFormula));
			return this.sortAndMapBadgeRoles([...assignedBadgeRoles, ...matchedBadgeCondRoles], publicOnly);
		} else {
			return this.sortAndMapBadgeRoles(assignedBadgeRoles, publicOnly);
		}
	}

	@bindThis
	private sortAndMapBadgeRoles(roles: MiRole[], publicOnly: boolean) {
		return roles
			.filter((r) => r.isPublic || !publicOnly)
			.sort((a, b) => b.displayOrder - a.displayOrder)
			.map((r) => ({
				name: r.name,
				iconUrl: r.iconUrl,
				displayOrder: r.displayOrder,
				behavior: r.badgeBehavior ?? undefined,
			}));
	}

	@bindThis
	public async getUserPolicies(userId: MiUser['id'] | null): Promise<RolePolicies> {
		const meta = await this.metaService.fetch();
		const basePolicies = { ...DEFAULT_POLICIES, ...meta.policies };

		if (userId == null) return basePolicies;

		const roles = await this.getUserRoles(userId);

		function calc<T extends keyof RolePolicies>(name: T, aggregate: (values: RolePolicies[T][]) => RolePolicies[T]) {
			if (roles.length === 0) return basePolicies[name];

			const policies = roles.map(role => role.policies[name] ?? { priority: 0, useDefault: true });

			const p2 = policies.filter(policy => policy.priority === 2);
			if (p2.length > 0) return aggregate(p2.map(policy => policy.useDefault ? basePolicies[name] : policy.value));

			const p1 = policies.filter(policy => policy.priority === 1);
			if (p1.length > 0) return aggregate(p1.map(policy => policy.useDefault ? basePolicies[name] : policy.value));

			return aggregate(policies.map(policy => policy.useDefault ? basePolicies[name] : policy.value));
		}

		return {
			gtlAvailable: calc('gtlAvailable', vs => vs.some(v => v === true)),
			ltlAvailable: calc('ltlAvailable', vs => vs.some(v => v === true)),
			canPublicNote: calc('canPublicNote', vs => vs.some(v => v === true)),
			canScheduleNote: calc('canScheduleNote', vs => vs.some(v => v === true)),
			scheduleNoteLimit: calc('scheduleNoteLimit', vs => Math.max(...vs)),
			scheduleNoteMaxDays: calc('scheduleNoteMaxDays', vs => Math.max(...vs)),
			canInitiateConversation: calc('canInitiateConversation', vs => vs.some(v => v === true)),
			canCreateContent: calc('canCreateContent', vs => vs.some(v => v === true)),
			canUpdateContent: calc('canUpdateContent', vs => vs.some(v => v === true)),
			canDeleteContent: calc('canDeleteContent', vs => vs.some(v => v === true)),
			canPurgeAccount: calc('canPurgeAccount', vs => vs.some(v => v === true)),
			canUpdateAvatar: calc('canUpdateAvatar', vs => vs.some(v => v === true)),
			canUpdateBanner: calc('canUpdateBanner', vs => vs.some(v => v === true)),
			mentionLimit: calc('mentionLimit', vs => Math.max(...vs)),
			canInvite: calc('canInvite', vs => vs.some(v => v === true)),
			inviteLimit: calc('inviteLimit', vs => Math.max(...vs)),
			inviteLimitCycle: calc('inviteLimitCycle', vs => Math.max(...vs)),
			inviteExpirationTime: calc('inviteExpirationTime', vs => Math.max(...vs)),
			canManageCustomEmojis: calc('canManageCustomEmojis', vs => vs.some(v => v === true)),
			canManageAvatarDecorations: calc('canManageAvatarDecorations', vs => vs.some(v => v === true)),
			canSearchNotes: calc('canSearchNotes', vs => vs.some(v => v === true)),
			canUseTranslator: calc('canUseTranslator', vs => vs.some(v => v === true)),
			canUseDriveFileInSoundSettings: calc('canUseDriveFileInSoundSettings', vs => vs.some(v => v === true)),
			canUseReaction: calc('canUseReaction', vs => vs.some(v => v === true)),
			canHideAds: calc('canHideAds', vs => vs.some(v => v === true)),
			driveCapacityMb: calc('driveCapacityMb', vs => Math.max(...vs)),
			alwaysMarkNsfw: calc('alwaysMarkNsfw', vs => vs.some(v => v === true)),
			skipNsfwDetection: calc('skipNsfwDetection', vs => vs.some(v => v === true)),
			pinLimit: calc('pinLimit', vs => Math.max(...vs)),
			antennaLimit: calc('antennaLimit', vs => Math.max(...vs)),
			antennaNotesLimit: calc('antennaNotesLimit', vs => Math.max(...vs)),
			wordMuteLimit: calc('wordMuteLimit', vs => Math.max(...vs)),
			webhookLimit: calc('webhookLimit', vs => Math.max(...vs)),
			clipLimit: calc('clipLimit', vs => Math.max(...vs)),
			noteEachClipsLimit: calc('noteEachClipsLimit', vs => Math.max(...vs)),
			userListLimit: calc('userListLimit', vs => Math.max(...vs)),
			userEachUserListsLimit: calc('userEachUserListsLimit', vs => Math.max(...vs)),
			rateLimitFactor: calc('rateLimitFactor', vs => Math.max(...vs)),
			avatarDecorationLimit: calc('avatarDecorationLimit', vs => Math.max(...vs)),
			mutualLinkSectionLimit: calc('mutualLinkSectionLimit', vs => Math.max(...vs)),
			mutualLinkLimit: calc('mutualLinkLimit', vs => Math.max(...vs)),
		};
	}

	@bindThis
	public async isModerator(user: { id: MiUser['id']; isRoot: MiUser['isRoot'] } | null): Promise<boolean> {
		if (user == null) return false;
		return user.isRoot || (await this.getUserRoles(user.id)).some(r => r.isModerator || r.isAdministrator);
	}

	@bindThis
	public async isAdministrator(user: { id: MiUser['id']; isRoot: MiUser['isRoot'] } | null): Promise<boolean> {
		if (user == null) return false;
		return user.isRoot || (await this.getUserRoles(user.id)).some(r => r.isAdministrator);
	}

	@bindThis
	public async isExplorable(role: { id: MiRole['id']} | null): Promise<boolean> {
		if (role == null) return false;
		const check = await this.rolesRepository.findOneBy({ id: role.id });
		if (check == null) return false;
		return check.isExplorable;
	}

	@bindThis
	public async getModeratorIds(includeAdmins = true): Promise<MiUser['id'][]> {
		const roles = await this.rolesCache.fetch(() => this.rolesRepository.findBy({}));
		const moderatorRoles = includeAdmins ? roles.filter(r => r.isModerator || r.isAdministrator) : roles.filter(r => r.isModerator);
		const assigns = moderatorRoles.length > 0 ? await this.roleAssignmentsRepository.findBy({
			roleId: In(moderatorRoles.map(r => r.id)),
		}) : [];
		// TODO: isRootなアカウントも含める
		return assigns.map(a => a.userId);
	}

	@bindThis
	public async getModerators(includeAdmins = true): Promise<MiUser[]> {
		const ids = await this.getModeratorIds(includeAdmins);
		const users = ids.length > 0 ? await this.usersRepository.findBy({
			id: In(ids),
		}) : [];
		return users;
	}

	@bindThis
	public async getAdministratorIds(): Promise<MiUser['id'][]> {
		const roles = await this.rolesCache.fetch(() => this.rolesRepository.findBy({}));
		const administratorRoles = roles.filter(r => r.isAdministrator);
		const assigns = administratorRoles.length > 0 ? await this.roleAssignmentsRepository.findBy({
			roleId: In(administratorRoles.map(r => r.id)),
		}) : [];
		// TODO: isRootなアカウントも含める
		return assigns.map(a => a.userId);
	}

	@bindThis
	public async getAdministrators(): Promise<MiUser[]> {
		const ids = await this.getAdministratorIds();
		const users = ids.length > 0 ? await this.usersRepository.findBy({
			id: In(ids),
		}) : [];
		return users;
	}

	@bindThis
	public async assign(userId: MiUser['id'], roleId: MiRole['id'], memo: string | null = null, expiresAt: Date | null = null, moderator?: MiUser): Promise<void> {
		const now = Date.now();

		const role = await this.rolesRepository.findOneByOrFail({ id: roleId });

		let existing = await this.roleAssignmentsRepository.findOneBy({
			roleId: roleId,
			userId: userId,
		});

		if (existing?.expiresAt && (existing.expiresAt.getTime() < now)) {
			await this.roleAssignmentsRepository.delete({
				roleId: roleId,
				userId: userId,
			});
			existing = null;
		}

		if (!existing) {
			const created = await this.roleAssignmentsRepository.insert({
				id: this.idService.gen(now),
				expiresAt: expiresAt,
				roleId: roleId,
				userId: userId,
				memo: memo,
			}).then(x => this.roleAssignmentsRepository.findOneByOrFail(x.identifiers[0]));

			this.globalEventService.publishInternalEvent('userRoleAssigned', created);

			if (role.isPublic) {
				this.notificationService.createNotification(userId, 'roleAssigned', {
					roleId: roleId,
				});
			}
		} else if (existing.expiresAt !== expiresAt || existing.memo !== memo) {
			await this.roleAssignmentsRepository.update(existing.id, {
				expiresAt: expiresAt,
				memo: memo,
			});
		} else {
			throw new IdentifiableError('67d8689c-25c6-435f-8ced-631e4b81fce1', 'User is already assigned to this role.');
		}

		this.rolesRepository.update(roleId, {
			lastUsedAt: new Date(),
		});

		if (moderator) {
			const user = await this.usersRepository.findOneByOrFail({ id: userId });
			this.moderationLogService.log(moderator, 'assignRole', {
				roleId: roleId,
				roleName: role.name,
				userId: userId,
				userUsername: user.username,
				userHost: user.host,
				expiresAt: expiresAt ? expiresAt.toISOString() : null,
				memo: memo,
			});
		}
	}

	@bindThis
	public async unassign(userId: MiUser['id'], roleId: MiRole['id'], moderator?: MiUser): Promise<void> {
		const now = new Date();

		let existing = await this.roleAssignmentsRepository.findOneBy({ roleId, userId });
		if (existing?.expiresAt && (existing.expiresAt.getTime() < now.getTime())) {
			await this.roleAssignmentsRepository.delete({
				roleId: roleId,
				userId: userId,
			});
			existing = null;
		}

		if (!existing) {
			throw new IdentifiableError('b9060ac7-5c94-4da4-9f55-2047c953df44', 'User was not assigned to this role.');
		}

		await this.roleAssignmentsRepository.delete(existing.id);

		this.rolesRepository.update(roleId, {
			lastUsedAt: now,
		});

		this.globalEventService.publishInternalEvent('userRoleUnassigned', existing);

		if (moderator) {
			const [user, role] = await Promise.all([
				this.usersRepository.findOneByOrFail({ id: userId }),
				this.rolesRepository.findOneByOrFail({ id: roleId }),
			]);
			this.moderationLogService.log(moderator, 'unassignRole', {
				roleId: roleId,
				roleName: role.name,
				userId: userId,
				userUsername: user.username,
				userHost: user.host,
				memo: existing.memo,
			});
		}
	}

	@bindThis
	public async addNoteToRoleTimeline(note: Packed<'Note'>): Promise<void> {
		const roles = await this.getUserRoles(note.userId);

		const redisPipeline = this.redisForTimelines.pipeline();

		for (const role of roles) {
			this.fanoutTimelineService.push(`roleTimeline:${role.id}`, note.id, 1000, redisPipeline);
			this.globalEventService.publishRoleTimelineStream(role.id, 'note', note);
		}

		redisPipeline.exec();
	}

	@bindThis
	public async create(values: Partial<MiRole>, moderator?: MiUser): Promise<MiRole> {
		const date = new Date();
		const created = await this.rolesRepository.insert({
			id: this.idService.gen(date.getTime()),
			updatedAt: date,
			lastUsedAt: date,
			name: values.name,
			description: values.description,
			color: values.color,
			iconUrl: values.iconUrl,
			target: values.target,
			condFormula: values.condFormula,
			isPublic: values.isPublic,
			isAdministrator: values.isAdministrator,
			isModerator: values.isModerator,
			isExplorable: values.isExplorable,
			asBadge: values.asBadge,
			badgeBehavior: values.badgeBehavior,
			canEditMembersByModerator: values.canEditMembersByModerator,
			displayOrder: values.displayOrder,
			policies: values.policies,
		}).then(x => this.rolesRepository.findOneByOrFail(x.identifiers[0]));

		this.globalEventService.publishInternalEvent('roleCreated', created);

		if (moderator) {
			this.moderationLogService.log(moderator, 'createRole', {
				roleId: created.id,
				role: created,
			});
		}

		return created;
	}

	@bindThis
	public async update(role: MiRole, params: Partial<MiRole>, moderator?: MiUser): Promise<void> {
		const date = new Date();
		await this.rolesRepository.update(role.id, {
			updatedAt: date,
			...params,
		});

		const updated = await this.rolesRepository.findOneByOrFail({ id: role.id });
		this.globalEventService.publishInternalEvent('roleUpdated', updated);

		if (moderator) {
			this.moderationLogService.log(moderator, 'updateRole', {
				roleId: role.id,
				before: role,
				after: updated,
			});
		}
	}

	@bindThis
	public async delete(role: MiRole, moderator?: MiUser): Promise<void> {
		await this.rolesRepository.delete({ id: role.id });
		this.globalEventService.publishInternalEvent('roleDeleted', role);

		if (moderator) {
			this.moderationLogService.log(moderator, 'deleteRole', {
				roleId: role.id,
				role: role,
			});
		}
	}

	@bindThis
	public dispose(): void {
		this.redisForSub.off('message', this.onMessage);
		this.roleAssignmentByUserIdCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
