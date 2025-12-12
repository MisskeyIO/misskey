import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

export type InlinePolicyOperation = 'set' | 'increment';

@Entity('user_inline_policy')
@Index(['userId'])
export class MiUserInlinePolicy {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		default: () => 'CURRENT_TIMESTAMP',
	})
	public createdAt: Date;

	@Index()
	@UpdateDateColumn({ type: 'timestamp with time zone' })
	public updatedAt: Date;

	@Column({
		...id(),
		comment: 'The user ID for this inline policy.',
	})
	public userId: MiUser['id'];

	@ManyToOne(() => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', {
		length: 128,
	})
	public policy: string;

	@Column('varchar', {
		length: 16,
	})
	public operation: InlinePolicyOperation;

	@Column('jsonb', {
		nullable: true,
	})
	public value: boolean | number | string | null;

	@Column('varchar', {
		length: 2048,
		nullable: true,
	})
	public memo: string | null;
}
