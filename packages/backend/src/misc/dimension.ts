import type { Packed } from '@/misc/json-schema.js';
import type { MiUser } from '@/models/User.js';

export function normalizeDimension(value: number | null | undefined, dimensionCount: number): number | null {
	const count = Math.max(1, dimensionCount);
	if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) return null;
	if (value <= 0 || value >= count) return null;
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

export function getDeliverTargetDimensions(
	noteDimension: number | null | undefined,
	replyDimension?: number | null | undefined,
	renoteDimension?: number | null | undefined,
): number[] {
	const targets = new Set<number>();
	
	// Normalize the note's dimension
	const normalizedNoteDimension = (typeof noteDimension === 'number' && noteDimension > 0) ? noteDimension : 0;
	
	// Determine if this note is private (dimension >= 1000)
	const isPrivateNote = normalizedNoteDimension >= 1000;
	
	// Add the note's own dimension
	if (normalizedNoteDimension > 0) {
		targets.add(normalizedNoteDimension);
	}
	
	// For non-private dimensions, also deliver to dimension-0 (base timeline)
	// Private notes (dimension >= 1000) should NEVER appear in dimension-0
	if (!isPrivateNote) {
		targets.add(0);
	}
	
	// If this is a reply to another dimension, also deliver to that dimension
	if (typeof replyDimension === 'number' && replyDimension > 0 && replyDimension !== normalizedNoteDimension) {
		targets.add(replyDimension);
	}
	
	// If this is a renote of another dimension, also deliver to that dimension
	if (typeof renoteDimension === 'number' && renoteDimension > 0 && renoteDimension !== normalizedNoteDimension) {
		targets.add(renoteDimension);
	}
	
	return Array.from(targets).sort((a, b) => a - b);
}
