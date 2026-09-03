import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { langmap, postingLangCodes } from '@/utility/langmap.js';
import type { PostingLanguage } from '@/utility/langmap.js';

const postingLanguageOptions = postingLangCodes.map((code) => ({
	value: code,
	text: code === 'other' ? i18n.ts.other : langmap[code]?.nativeName ?? code,
}));

export async function selectPostingLanguage(current: PostingLanguage | null): Promise<PostingLanguage | null | undefined> {
	const { canceled, result } = await os.select<PostingLanguage | null>({
		title: i18n.ts.postingLanguage,
		items: postingLanguageOptions,
		default: current ?? null,
	});
	if (canceled) return undefined;
	return result;
}

export function getAutoPostingLang(browserLanguage?: string | null): PostingLanguage {
	if (browserLanguage) {
		const normalized = browserLanguage.toLowerCase();
		if (normalized.startsWith('ko')) return 'ko-KR';
		if (normalized.startsWith('ja')) return 'ja-JP';
	}
	return 'ja-JP';
}

export function getDefaultViewingLangs(postingLang: PostingLanguage): (PostingLanguage | 'unknown' | 'remote')[] {
	return Array.from(new Set([postingLang, 'ja-JP', 'unknown', 'remote']));
}
