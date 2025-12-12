import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { UserInlinePoliciesRepository, UsersRepository } from '@/models/_.js';
import { MiUserInlinePolicy } from '@/models/_.js';
import { DEFAULT_POLICIES, RoleService } from '@/core/RoleService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '@/server/api/error.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';

export const meta = {
	tags: ['admin', 'role'],

	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:roles',

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'f5b42979-e8e7-4027-9022-3e507ad29828',
		},

		invalidPolicy: {
			message: 'Invalid policy.',
			code: 'INVALID_PARAM',
			id: '52109192-4e49-4d10-8844-899281fde5a3',
		},

		invalidOperation: {
			message: 'Invalid operation.',
			code: 'INVALID_PARAM',
			id: 'e0a8b82d-925a-414a-a5fe-993ee35efc6a',
		},

		invalidValue: {
			message: 'Invalid value.',
			code: 'INVALID_PARAM',
			id: '6f33c598-400e-4afa-aeb7-9b18965368c4',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		policies: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: { type: 'string', nullable: true },
					policy: { type: 'string', enum: Object.keys(DEFAULT_POLICIES) as (keyof typeof DEFAULT_POLICIES)[] },
					operation: { type: 'string', enum: ['set', 'increment'], default: 'set' },
					value: { oneOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }, { type: 'null' }] },
					memo: { type: 'string', nullable: true },
				},
				required: ['policy'],
			},
		},
	},
	required: ['userId', 'policies'],
} as const;

type InlinePolicyInput = {
	id?: string | null;
	policy: keyof typeof DEFAULT_POLICIES;
	operation?: 'set' | 'increment';
	value?: boolean | number | string | null;
	memo?: string | null;
};

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	private readonly policyNames = Object.keys(DEFAULT_POLICIES) as (keyof typeof DEFAULT_POLICIES)[];

	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		@Inject(DI.userInlinePoliciesRepository)
		private userInlinePoliciesRepository: UserInlinePoliciesRepository,

		private roleService: RoleService,
		private moderationLogService: ModerationLogService,
		private idService: IdService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const user = await this.usersRepository.findOneBy({ id: ps.userId });

			if (user == null) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			const sanitizedPolicies = ps.policies.map(policy => this.validatePolicyInput(policy));
			const before = (await this.userInlinePoliciesRepository.findBy({ userId: user.id })).map(this.serialize);

			await this.userInlinePoliciesRepository.manager.transaction(async (manager) => {
				await manager.delete(MiUserInlinePolicy, { userId: user.id });

				if (sanitizedPolicies.length > 0) {
					await manager.insert(MiUserInlinePolicy,
						sanitizedPolicies.map(inlinePolicy => ({
							id: this.idService.gen(),
							userId: user.id,
							policy: inlinePolicy.policy,
							operation: inlinePolicy.operation,
							value: inlinePolicy.value,
							memo: inlinePolicy.memo ?? null,
						}))
					);
				}
			});

			this.roleService.clearInlinePolicyCache(user.id);
			this.globalEventService.publishInternalEvent('userInlinePoliciesUpdated', { userId: user.id });
			const after = (await this.userInlinePoliciesRepository.findBy({ userId: user.id })).map(this.serialize);

			this.moderationLogService.log(me, 'updateInlinePolicies', {
				userId: user.id,
				userUsername: user.username,
				userHost: user.host,
				before,
				after,
			});
		});
	}

	private serialize(policy: MiUserInlinePolicy) {
		return {
			id: policy.id,
			policy: policy.policy,
			operation: policy.operation,
			value: policy.value,
			memo: policy.memo,
		};
	}

	private validatePolicyInput(input: InlinePolicyInput): Required<InlinePolicyInput> {
		if (!this.policyNames.includes(input.policy)) throw new ApiError(meta.errors.invalidPolicy);

		const baseValue = DEFAULT_POLICIES[input.policy];
		const operation = input.operation ?? 'set';

		if (operation === 'increment') {
			if (typeof baseValue !== 'number') throw new ApiError(meta.errors.invalidOperation);
			if (typeof input.value !== 'number' || !Number.isFinite(input.value)) throw new ApiError(meta.errors.invalidValue);

			return {
				...input,
				operation,
				value: input.value,
			} as Required<InlinePolicyInput>;
		}

		if (typeof baseValue === 'boolean') {
			if (typeof input.value !== 'boolean') throw new ApiError(meta.errors.invalidValue);
		} else if (typeof baseValue === 'number') {
			if (typeof input.value !== 'number' || !Number.isFinite(input.value)) throw new ApiError(meta.errors.invalidValue);
		}

		return {
			...input,
			operation,
			value: input.value,
		} as Required<InlinePolicyInput>;
	}
}
