/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('user_account_move_log')
export class MiUserAccountMoveLog {
	@PrimaryColumn(id())
	public id: string;

	@Index('IDX_user_account_move_log_movedToId')
	@Column(id())
	public movedToId: MiUser['id'];

	@ManyToOne(() => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'movedToId', referencedColumnName: 'id', foreignKeyConstraintName: 'FK_user_account_move_log_movedToId' })
	public movedTo: MiUser | null;

	@Index('IDX_user_account_move_log_movedFromId')
	@Column(id())
	public movedFromId: MiUser['id'];

	@ManyToOne(() => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'movedFromId', referencedColumnName: 'id', foreignKeyConstraintName: 'FK_user_account_move_log_movedFromId' })
	public movedFrom: MiUser | null;

	@Column('timestamp with time zone', {
		comment: 'The created date of the UserAccountMoveLog.',
		default: () => 'CURRENT_TIMESTAMP',
	})
	public createdAt: Date;
}
