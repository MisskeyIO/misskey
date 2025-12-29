import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';

export async function selectDimension(current?: number | null): Promise<number | undefined> {
	const max = Math.max(instance.dimensions ?? 1, 1);
	const { canceled, result } = await os.inputNumber({
		title: i18n.ts.dimension,
		default: current ?? prefer.r.dimension.value,
		min: 0,
		max,
	});
	if (canceled || result == null) return undefined;
	return result;
}
