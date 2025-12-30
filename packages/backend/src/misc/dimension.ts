import type { Packed } from '@/misc/json-schema.js';
import type { MiUser } from '@/models/User.js';

export function normalizeDimension(value: number | null | undefined, dimensionCount: number): number {
	const count = Math.max(1, dimensionCount);
	if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) return 0;
	if (value < 0 || value >= count) return 0;
	return value;
}

export function getNoteDimension(note: Packed<'Note'>): number {
	return typeof note.dimension === 'number' ? note.dimension : 0;
}

export function isCrossDimensionInteraction(note: Packed<'Note'>, viewerId: MiUser['id'] | null | undefined): boolean {
	if (!viewerId) return false;

	if (note.mentions?.includes(viewerId)) return true;
	if (note.visibleUserIds?.includes(viewerId)) return true;
	if (note.reply?.userId === viewerId) return true;
	if (note.renote?.userId === viewerId) return true;

	return false;
}

export function shouldDeliverByDimension(note: Packed<'Note'>, viewerDimension: number | null | undefined, viewerId: MiUser['id'] | null | undefined): boolean {
	if (viewerDimension == null) return true;
	if (isCrossDimensionInteraction(note, viewerId)) return true;

	const isVisible = (targetDimension: number) => {
		if (targetDimension === 0) return viewerDimension === 0;
		if (viewerDimension === 0) return targetDimension < 1000;
		return viewerDimension === targetDimension;
	};

	if (isVisible(getNoteDimension(note))) return true;

	if (note.renote && isVisible(getNoteDimension(note.renote))) return true;

	return false;
}
