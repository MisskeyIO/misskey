/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Entity, Index, JoinColumn, Column, PrimaryColumn, ManyToOne } from 'typeorm';
import type { noteReactionAcceptances, noteVisibilities } from '@/types.js';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import type { MiChannel } from './Channel.js';
import type { MiDriveFile } from './DriveFile.js';
import type { MiNote } from './Note.js';

export type ScheduledNoteDraft = {
	text: string | null;
	cw: string | null;
	visibility: typeof noteVisibilities[number];
	visibleUserIds: MiUser['id'][];
	localOnly: boolean;
	reactionAcceptance: typeof noteReactionAcceptances[number] | null;
	fileIds: MiDriveFile['id'][];
	files?: MiDriveFile[] | null;
	poll: {
		choices: string[];
		multiple: boolean;
		expiresAt: Date | string | null;
		expiredAfter: number | null;
	} | null;
	replyId: MiNote['id'] | null;
	reply?: MiNote | null;
	renoteId: MiNote['id'] | null;
	renote?: MiNote | null;
	channelId: MiChannel['id'] | null;
	channel?: MiChannel | null;
};

@Entity('note_scheduled')
@Index(['userId', 'scheduledAt'], { unique: true })
export class MiScheduledNote {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the Note.',
		default: () => 'CURRENT_TIMESTAMP',
	})
	public createdAt: Date;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The scheduled date of the Note.',
		nullable: true,
	})
	public scheduledAt: Date | null;

	@Column('varchar', {
		length: 256, nullable: true,
	})
	public reason: string | null;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of author.',
	})
	public userId: MiUser['id'];

	@ManyToOne(() => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('jsonb')
	public draft: ScheduledNoteDraft;

	constructor(data?: Partial<MiScheduledNote>) {
		if (data == null) return;

		Object.assign(this, data);
	}
}
