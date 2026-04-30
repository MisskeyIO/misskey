/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { AhoCorasick } from 'slacc';
import RE2 from 're2';
import type { MiNote } from '@/models/Note.js';
import type { MiUser } from '@/models/User.js';

type NoteLike = {
	userId: MiNote['userId'];
	text: MiNote['text'];
	cw?: MiNote['cw'];
};

type UserLike = {
	id: MiUser['id'];
};

const acCache = new Map<string, AhoCorasick>();

function matchesMutedFilter(filter: string | string[], text: string): boolean {
	if (Array.isArray(filter)) {
		return filter.every(keyword => text.includes(keyword));
	}

	// represents RegExp
	const regexp = filter.match(/^\/(.+)\/(.*)$/);

	// This should never happen due to input sanitisation.
	if (!regexp) return false;

	try {
		return new RE2(regexp[1], regexp[2]).test(text);
	} catch (err) {
		// This should never happen due to input sanitisation.
		return false;
	}
}

export async function checkWordMute(note: NoteLike, me: UserLike | null | undefined, mutedWords: Array<string | string[]>): Promise<boolean> {
	// 自分自身
	if (me && (note.userId === me.id)) return false;

	if (mutedWords.length > 0) {
		const text = ((note.cw ?? '') + '\n' + (note.text ?? '')).trim();

		if (text === '') return false;

		const normalizeKeywordFilter = (keywords: string[]): string[] => {
			return keywords
				.map(keyword => keyword.trim())
				.filter(keyword => keyword !== '');
		};

		const normalizedWords = mutedWords
			.map(filter => {
				if (!Array.isArray(filter)) return filter;
				return normalizeKeywordFilter(filter);
			})
			.filter((filter): filter is string | string[] => !Array.isArray(filter) || filter.length > 0);

		const acable = normalizedWords
			.filter((filter): filter is string[] => Array.isArray(filter) && filter.length === 1)
			.map(filter => filter[0])
			.sort((a, b) => a.localeCompare(b));
		const unacable = normalizedWords.filter(filter => !Array.isArray(filter) || filter.length !== 1);
		if (acable.length > 0) {
			const acCacheKey = acable.join('\n');
			const ac = acCache.get(acCacheKey) ?? AhoCorasick.withPatterns(acable);
			acCache.delete(acCacheKey);
			acCache.set(acCacheKey, ac);
			while (acCache.size > 1000) {
				const obsoleteKey = acCache.keys().next().value;
				if (obsoleteKey === undefined) break;
				acCache.delete(obsoleteKey);
			}
			if (ac.isMatch(text)) {
				return true;
			}
		}

		const matched = unacable.some(filter => matchesMutedFilter(filter, text));

		if (matched) return true;
	}

	return false;
}
