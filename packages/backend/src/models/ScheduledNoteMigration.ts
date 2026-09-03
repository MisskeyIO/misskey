/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';

@Entity('note_scheduled_migration')
export class MiScheduledNoteMigration {
	@PrimaryColumn({
		...id(),
		primaryKeyConstraintName: 'PK_note_scheduled_migration',
	})
	public noteScheduledId: string;

	@Column('boolean')
	public wasActive: boolean;
}
