/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'misskey-js';
import type { PostingLanguage } from '@/utility/langmap.js';

export type LegacyNoteDraft = Omit<Misskey.entities.ScheduledNote, 'id' | 'data'> & {
	data: Omit<Misskey.entities.ScheduledNote['data'], 'files' | 'lang'> & {
		files?: Misskey.entities.ScheduledNote['data']['files'];
		lang?: PostingLanguage | null;
		quoteId?: string | null;
		reactionAcceptance?: Misskey.entities.Note['reactionAcceptance'];
	};
};

export type LegacyNoteDraftEntry = {
	key: string;
	draft: LegacyNoteDraft;
	fingerprint: string;
};

type CreateDraftRequest = Misskey.Endpoints['notes/drafts/create']['req'];

function isRecord(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function parseLegacyNoteDrafts(raw: string | null): {
	entries: LegacyNoteDraftEntry[];
	invalidCount: number;
	parseFailed: boolean;
} {
	if (raw == null) return { entries: [], invalidCount: 0, parseFailed: false };

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { entries: [], invalidCount: 0, parseFailed: true };
	}

	if (!isRecord(parsed)) return { entries: [], invalidCount: 0, parseFailed: true };

	const entries: LegacyNoteDraftEntry[] = [];
	let invalidCount = 0;
	for (const [key, value] of Object.entries(parsed)) {
		if (!isRecord(value) || !isRecord(value.data)) {
			invalidCount++;
			continue;
		}
		entries.push({
			key,
			draft: value as LegacyNoteDraft,
			fingerprint: JSON.stringify(value),
		});
	}

	return { entries, invalidCount, parseFailed: false };
}

export function removeUnchangedLegacyNoteDraft(raw: string | null, key: string, fingerprint: string): string | null {
	if (raw == null) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	if (!isRecord(parsed) || JSON.stringify(parsed[key]) !== fingerprint) return null;
	delete parsed[key];
	return JSON.stringify(parsed);
}

function fileIds(files: Misskey.entities.DriveFile[] | undefined): { fileIds?: string[] } {
	return files?.length ? { fileIds: files.map(file => file.id) } : {};
}

export function legacyNoteDraftToRequest(draft: LegacyNoteDraft): CreateDraftRequest {
	let scheduledAt = draft.scheduledAt == null ? null : Date.parse(draft.scheduledAt);
	if (scheduledAt != null && Number.isNaN(scheduledAt)) throw new Error('Invalid scheduledAt');
	if (scheduledAt != null && scheduledAt < Date.now()) scheduledAt = null;

	return {
		text: draft.data.text ?? null,
		cw: draft.data.useCw ? draft.data.cw ?? null : null,
		visibility: draft.data.visibility,
		localOnly: (draft.data.dimension ?? 0) >= 1000 ? true : draft.data.localOnly,
		dimension: draft.data.dimension ?? null,
		lang: (draft.data.lang ?? null) as CreateDraftRequest['lang'],
		scheduledAt,
		...fileIds(draft.data.files),
		poll: draft.data.poll ?? null,
		visibleUserIds: draft.data.visibleUserIds ?? [],
		renoteId: draft.renote?.id ?? draft.data.quoteId ?? null,
		replyId: draft.reply?.id ?? null,
		channelId: draft.channel?.id ?? null,
		reactionAcceptance: draft.data.reactionAcceptance ?? null,
	};
}

export function scheduledNoteToDraftRequest(draft: Misskey.entities.ScheduledNote): CreateDraftRequest {
	return {
		text: draft.data.text ?? null,
		cw: draft.data.useCw ? draft.data.cw ?? null : null,
		visibility: draft.data.visibility,
		localOnly: (draft.data.dimension ?? 0) >= 1000 ? true : draft.data.localOnly,
		dimension: draft.data.dimension ?? null,
		lang: (draft.data.lang ?? null) as CreateDraftRequest['lang'],
		scheduledAt: null,
		...fileIds(draft.data.files),
		poll: draft.data.poll ?? null,
		visibleUserIds: draft.data.visibleUserIds ?? [],
		renoteId: draft.renote?.id ?? null,
		replyId: draft.reply?.id ?? null,
		channelId: draft.channel?.id ?? null,
		reactionAcceptance: draft.data.reactionAcceptance ?? null,
	};
}
