import { LRUCache } from 'lru-cache';

// eslint-disable-next-line @typescript-eslint/ban-types
export async function cacheFetch<K extends {}, V extends {}, FC = unknown>(
	cache: LRUCache<K, V, FC>,
	key: K,
	context?: FC,
	forceRefresh?: boolean,
): Promise<V | null> {
	const status: LRUCache.Status<V> = {};
	// @ts-expect-error typescript doesn't understand what's going on here
	const value = await cache.fetch(key, { forceRefresh, context, status });
	if (status.fetchRejected) throw new Error('fetchMethod promise was rejected!');

	return value ?? null;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export async function cacheFetchOrFail<K extends {}, V extends {}, FC = unknown>(
	cache: LRUCache<K, V, FC>,
	key: K,
	context?: FC,
	forceRefresh?: boolean,
): Promise<V> {
	const status: LRUCache.Status<V> = {};
	// @ts-expect-error typescript doesn't understand what's going on here
	const value = await cache.fetch(key, { forceRefresh, context, status });
	if (status.fetchRejected) throw new Error('fetchMethod promise was rejected!');
	if (value === undefined) throw new Error('fetchMethod returned undefined value!');

	return value;
}
