/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { langmap, postingLangCodes } from '@/utility/langmap.js';

export type PostingLangCode = typeof postingLangCodes[number];

export const viewingLangCodes = [
	...postingLangCodes,
	'unknown',
	'remote',
] as const;

export type ViewingLangCode = typeof viewingLangCodes[number];

export function isPostingLangCode(code: string | null | undefined): code is PostingLangCode {
	return typeof code === 'string' && postingLangCodes.some(value => value === code);
}

export function normalizePostingLang(code: string | null | undefined): PostingLangCode | null {
	return isPostingLangCode(code) ? code : null;
}

export function isViewingLangCode(code: string | null | undefined): code is ViewingLangCode {
	return typeof code === 'string' && viewingLangCodes.some(value => value === code);
}

export function normalizeViewingLangs(codes: readonly string[] | null | undefined): ViewingLangCode[] {
	return codes?.filter(isViewingLangCode) ?? [];
}

export function getPostingLanguageLabel(code: string | null | undefined): string {
	if (code == null) return i18n.ts.notSet;
	if (code === 'other') return i18n.ts.other;

	return langmap[code as keyof typeof langmap]?.nativeName ?? code;
}

export function getViewingLanguageLabel(code: string): string {
	if (code === 'unknown') return i18n.ts.unknown;
	if (code === 'remote') return i18n.ts.remote;

	return getPostingLanguageLabel(code);
}

export const postingLanguageSelectItems = postingLangCodes.map((code) => ({
	value: code,
	label: getPostingLanguageLabel(code),
}));

const postingLanguageDialogItems = postingLangCodes.map((code) => ({
	value: code,
	label: getPostingLanguageLabel(code),
}));

export async function selectPostingLanguage(current: string | null): Promise<string | null | undefined> {
	const { canceled, result } = await os.select<string | null, string | null>({
		title: i18n.ts.postingLanguage,
		items: [
			{ value: null, label: i18n.ts.notSet },
			...postingLanguageDialogItems,
		],
		default: current,
	});
	if (canceled) return undefined;
	return result;
}

export function getAutoPostingLang(browserLanguage?: string | null): PostingLangCode {
	if (browserLanguage) {
		const normalized = browserLanguage.toLowerCase();
		const exact = postingLangCodes.find(code => code.toLowerCase() === normalized);
		if (exact != null) return exact;

		const primary = normalized.split('-')[0];
		const primaryMatch = postingLangCodes.find(code => code.toLowerCase() === primary);
		if (primaryMatch != null) return primaryMatch;
	}

	return 'ja-JP';
}

export function getDefaultViewingLangs(postingLang: PostingLangCode): ViewingLangCode[] {
	return Array.from(new Set<ViewingLangCode>([postingLang, 'ja-JP', 'unknown', 'remote']));
}
