/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';

function getMaxDimension(): number | null {
	const meta = instance as Misskey.entities.MetaDetailed & { dimensions?: number | null };
	if (typeof meta.dimensions !== 'number' || !Number.isFinite(meta.dimensions)) return null;
	return Math.max(0, Math.trunc(meta.dimensions) - 1);
}

export async function selectDimension(current?: number | null): Promise<number | undefined> {
	const max = getMaxDimension();
	const { canceled, result } = await os.inputNumber({
		title: i18n.ts.dimension,
		text: max == null ? undefined : i18n.tsx.dimensionRange({ min: 0, max }),
		default: current ?? prefer.s.dimension,
	});

	if (canceled || result == null) return undefined;
	const dimension = Math.trunc(result);
	if (!Number.isFinite(result) || result !== dimension || dimension < 0 || (max != null && dimension > max)) {
		await os.alert({
			type: 'error',
			text: max == null ? i18n.ts.dimensionInvalid : i18n.tsx.dimensionOutOfRange({ min: 0, max }),
		});
		return undefined;
	}

	return dimension;
}
