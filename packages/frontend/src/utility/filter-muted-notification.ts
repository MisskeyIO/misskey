import * as Misskey from 'misskey-js';
import { store } from '@/store.js';

export function filterMutedNotification(notification: Misskey.entities.Notification): boolean {
	switch (notification.type) {
		case 'reaction':
			if (store.s.mutedReactions.includes(notification.reaction.replace('@.', ''))) return false;
			break;
		case 'reaction:grouped':
			notification.reactions = notification.reactions.filter(reaction => !store.s.mutedReactions.includes(reaction.reaction.replace('@.', '')));
			if (notification.reactions.length === 0) return false;
			break;
	}

	return true;
}
