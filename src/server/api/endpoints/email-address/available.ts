import $ from 'cafy';
import validate from 'deep-email-validator';
import define from '../../define';
import { UserProfiles } from '@/models/index';
import {isValidAddress} from 'ip-cidr';
import {apiLogger} from '@/server/api/logger';
import {options} from 'tsconfig-paths/lib/options';

export const meta = {
	tags: ['users'],

	requireCredential: false as const,

	params: {
		emailAddress: {
			validator: $.str
		}
	},

	res: {
		type: 'object' as const,
		optional: false as const, nullable: false as const,
		properties: {
			available: {
				type: 'boolean' as const,
				optional: false as const, nullable: false as const,
			}
		}
	}
};

export default define(meta, async (ps) => {
	let exist = await UserProfiles.count({
		emailVerified: true,
		email: ps.emailAddress,
	});

	const res = await validate({
		email: ps.emailAddress,
		validateRegex: true,
		validateMx: true,
		validateTypo: false, // TLDを見ているみたいだけどclubとか弾かれるので
		validateDisposable: true,
		validateSMTP: false // 日本だと25ポートが殆どのプロバイダーで塞がれていてタイムアウトになるので
	});
	if (!res.valid) exist = 1;

	return {
		available: exist === 0
	};
});
