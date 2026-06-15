/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('indie_auth_client')
export class MiIndieAuthClient {
	@PrimaryColumn('varchar', {
		length: 512,
	})
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		default: () => 'CURRENT_TIMESTAMP',
	})
	public createdAt: Date;

	@Column('varchar', {
		length: 256,
		nullable: true,
	})
	public name: string | null;

	@Column('varchar', {
		length: 512,
		array: true,
		default: '{}',
	})
	public redirectUris: string[];
}
