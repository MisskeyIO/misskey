/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { shouldHideNoteByTime } from '@/misc/should-hide-note-by-time.js';
import type { Packed } from '@/misc/json-schema.js';
import type { MiMeta } from '@/models/_.js';

export function isNoteCacheableForVisitor(
	note: Packed<'Note'>,
	ugcVisibilityForVisitor: MiMeta['ugcVisibilityForVisitor'],
): boolean {
	if (note.visibility !== 'public' && note.visibility !== 'home') return false;
	if (note.isHidden) return false;
	if (note.user.requireSigninToViewContents) return false;
	if (shouldHideNoteByTime(note.user.makeNotesHiddenBefore, note.createdAt)) return false;
	if (ugcVisibilityForVisitor !== 'all' && ugcVisibilityForVisitor !== 'local') return false;
	if (ugcVisibilityForVisitor === 'local' && note.user.host != null) return false;

	if (note.reply && !isNoteCacheableForVisitor(note.reply, ugcVisibilityForVisitor)) return false;
	if (note.renote && !isNoteCacheableForVisitor(note.renote, ugcVisibilityForVisitor)) return false;

	return true;
}
