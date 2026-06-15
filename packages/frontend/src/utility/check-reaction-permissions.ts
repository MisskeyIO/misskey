/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'misskey-js';
import type { UnicodeEmojiDef } from '@@/js/emojilist.js';

type EmojiSimpleWithFeature10Fields = Misskey.entities.EmojiSimple & {
	roleIdsThatCanNotBeUsedThisEmojiAsReaction?: string[];
};

export function checkReactionPermissions(me: Misskey.entities.MeDetailed, note: Misskey.entities.Note, emoji: EmojiSimpleWithFeature10Fields | UnicodeEmojiDef | string): boolean {
	if (typeof emoji === 'string') return true; // UnicodeEmojiDefにも無い絵文字であれば文字列で来る。Unicode絵文字であることには変わりないので常にリアクション可能とする;
	if ('char' in emoji) return true; // UnicodeEmojiDefなら常にリアクション可能

	const roleIdsThatCanBeUsedThisEmojiAsReaction = emoji.roleIdsThatCanBeUsedThisEmojiAsReaction ?? [];
	const roleIdsThatCanNotBeUsedThisEmojiAsReaction = emoji.roleIdsThatCanNotBeUsedThisEmojiAsReaction ?? [];
	return !(emoji.localOnly && note.user.host !== me.host)
      && !(emoji.isSensitive && (note.reactionAcceptance === 'nonSensitiveOnly' || note.reactionAcceptance === 'nonSensitiveOnlyForLocalLikeOnlyForRemote'))
      && !me.roles.some(role => roleIdsThatCanNotBeUsedThisEmojiAsReaction.includes(role.id))
      && (roleIdsThatCanBeUsedThisEmojiAsReaction.length === 0 || me.roles.some(role => roleIdsThatCanBeUsedThisEmojiAsReaction.includes(role.id)));
}
