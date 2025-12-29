import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('user_lang')
export class MiUserLanguage {
	@PrimaryColumn(id())
	public userId: MiUser['id'];

	@OneToOne(() => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', {
		length: 32,
		nullable: true,
	})
	public postingLang: string | null;

	@Column('varchar', {
		array: true,
		default: '{}',
	})
	public viewingLangs: string[];

	@UpdateDateColumn({ type: 'timestamp with time zone' })
	public updatedAt: Date;
}
