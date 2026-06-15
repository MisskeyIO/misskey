/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { MiUser } from './User.js';
import { id } from './util/id.js';

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
 		length: 32,
 		array: true,
 		default: '{}',
 	})
 	public viewingLangs: string[];

 	@Column('boolean', {
 		default: true,
 	})
 	public showMediaInAllLanguages: boolean;

 	@Column('boolean', {
 		default: true,
 	})
 	public showHashtagsInAllLanguages: boolean;

 	@UpdateDateColumn({ type: 'timestamp with time zone' })
 	public updatedAt: Date;
}
