import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { langmap } from '@/utility/langmap.js';

const postingLanguageOptions = Object.entries(langmap).map(([code, info]) => ({
	value: code,
	text: info.nativeName ?? code,
}));

export async function selectPostingLanguage(current: string | null): Promise<string | null | undefined> {
	const { canceled, result } = await os.select<string | null>({
		title: i18n.ts.postingLanguage,
		items: postingLanguageOptions,
		default: current ?? null,
	});
	if (canceled) return undefined;
	return result;
}
