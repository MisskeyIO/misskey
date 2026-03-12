import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { langmap, postingLangCodes } from '@/utility/langmap.js';

const postingLanguageOptions = postingLangCodes.map((code) => ({
	value: code,
	text: code === 'other' ? i18n.ts.other : langmap[code]?.nativeName ?? code,
}));

export async function selectPostingLanguage(current: string | null): Promise<string | null | undefined> {
	const { canceled, result } = await os.select<(typeof postingLangCodes)[number], (typeof postingLangCodes)[number] | null>({
		title: i18n.ts.postingLanguage,
		items: postingLanguageOptions,
		default: current === null ? null : postingLangCodes.includes(current as (typeof postingLangCodes)[number]) ? current as (typeof postingLangCodes)[number] : null,
	});
	if (canceled) return undefined;
	return result;
}

export function getAutoPostingLang(browserLanguage?: string | null): (typeof postingLangCodes)[number] {
	if (browserLanguage) {
		const normalized = browserLanguage.toLowerCase();
		if (normalized.startsWith('ko')) return 'ko-KR';
		if (normalized.startsWith('ja')) return 'ja-JP';
	}
	return 'ja-JP';
}

export function getDefaultViewingLangs(postingLang: (typeof postingLangCodes)[number]): Array<(typeof postingLangCodes)[number] | 'unknown' | 'remote'> {
	return Array.from(new Set([postingLang, 'ja-JP', 'unknown', 'remote']));
}
