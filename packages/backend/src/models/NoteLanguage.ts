import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiNote } from './Note.js';

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
