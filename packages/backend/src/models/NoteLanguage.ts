/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { MiNote } from './Note.js';
import { id } from './util/id.js';

@Entity('note_lang')
export class MiNoteLanguage {
 	@PrimaryColumn(id())
 	public noteId: MiNote['id'];

 	@OneToOne(() => MiNote, {
 		onDelete: 'CASCADE',
 	})
 	@JoinColumn()
 	public note: MiNote | null;

 	@Column('varchar', {
 		length: 32,
 	})
 	public lang: string;
}
