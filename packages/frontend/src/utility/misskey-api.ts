/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'misskey-js';
import { ref } from 'vue';
import { apiUrl } from '@@/js/config.js';
import { time as gtagTime } from 'vue-gtag';
import { $i } from '@/i.js';
import { miLocalStorage } from '@/local-storage.js';
import { instance } from '@/instance.js';
export const pendingApiRequestsCount = ref(0);

let id: string | null = miLocalStorage.getItem('id');
export function generateClientTransactionId(initiator: string) {
	if (id === null) {
		id = crypto.randomUUID().replaceAll('-', '');
		miLocalStorage.setItem('id', id);
	}

	// ハイフンが含まれている場合は除去
	if (id.includes('-')) {
		id = id.replaceAll('-', '');
		miLocalStorage.setItem('id', id);
	}

	return `${id}-${initiator}-${crypto.randomUUID().replaceAll('-', '')}`;
}

function handleResponse<_ResT>(
	resolve: (value: (_ResT | PromiseLike<_ResT>)) => void,
	reject: (reason?: any) => void,
): ((value: Response) => (void | PromiseLike<void>)) {
	return async (res) => {
		if (res.ok && res.status !== 204) {
			const body = await res.json();
			resolve(body);
		} else if (res.status === 204) {
			resolve(undefined as _ResT); // void -> undefined
		} else {
			// エラー応答で JSON.parse に失敗した場合は HTTP ステータスコードとメッセージを返す
			const body = await res
				.json()
				.catch(() => ({ statusCode: res.status, message: res.statusText }));
			reject(typeof body.error === 'object' ? body.error : body);
		}
	};
}

export type Endpoint = keyof Misskey.Endpoints;

export type Request<E extends Endpoint> = Misskey.Endpoints[E]['req'];
type ApiResponseType<E extends Endpoint, P extends Request<E>> = Misskey.api.SwitchCaseResponseType<E, P>;
type ApiRequestBody = Record<string, unknown> & { i?: string | null };

// Implements Misskey.api.ApiClient.request
export function misskeyApi<
	E extends Endpoint,
 	P extends Request<E>,
>(
	endpoint: E,
	data: P,
	token?: string | null | undefined,
	signal?: AbortSignal,
	initiator?: string,
): Promise<ApiResponseType<E, P>>;
export function misskeyApi<
	E extends Endpoint,
>(
	endpoint: E,
	data?: Request<E>,
	token?: string | null | undefined,
	signal?: AbortSignal,
	initiator?: string,
): Promise<ApiResponseType<E, Request<E>>>;
export function misskeyApi<ResT = unknown>(
	endpoint: string,
	data?: ApiRequestBody,
	token?: string | null | undefined,
	signal?: AbortSignal,
	initiator?: string,
): Promise<ResT>;
export function misskeyApi(
	endpoint: string,
	data: Record<string, unknown> = {},
	token?: string | null | undefined,
	signal?: AbortSignal,
	initiator = 'misskey',
): Promise<unknown> {
	if (endpoint.includes('://')) throw new Error('invalid endpoint');
	pendingApiRequestsCount.value++;

	const credential = token ? token : $i ? $i.token : undefined;

	const onFinally = () => {
		pendingApiRequestsCount.value--;
	};

	const promise = new Promise<unknown>((resolve, reject) => {
		const payload: ApiRequestBody = { ...data };
		// Append a credential
		if ($i) payload.i = $i.token;
		if (token !== undefined) payload.i = token;

		// Send request
		const initiateTime = Date.now();
		window.fetch(`${apiUrl}/${endpoint}`, {
			method: 'POST',
			body: JSON.stringify(payload),
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': credential ? `Bearer ${credential}` : 'anonymous',
				'X-Client-Transaction-Id': generateClientTransactionId(initiator),
			},
			signal,
		}).then(res => {
			if (instance.googleAnalyticsId) {
				gtagTime({
					event_category: 'api',
					event_label: `/${endpoint}`,
					value: Date.now() - initiateTime,
				});
			}
			return res;
		}).then(handleResponse(resolve, reject)).catch(reject);
	});

	promise.then(onFinally, onFinally);

	return promise;
}

// Implements Misskey.api.ApiClient.request
export function misskeyApiGet<
	E extends Endpoint,
 	P extends Request<E>,
>(
	endpoint: E,
	data: P,
	initiator?: string,
): Promise<ApiResponseType<E, P>>;
export function misskeyApiGet<
	E extends Endpoint,
>(
	endpoint: E,
	data?: Request<E>,
	initiator?: string,
): Promise<ApiResponseType<E, Request<E>>>;
export function misskeyApiGet<ResT = unknown>(
	endpoint: string,
	data?: Record<string, unknown>,
	initiator?: string,
): Promise<ResT>;
export function misskeyApiGet(
	endpoint: string,
	data: Record<string, unknown> = {},
	initiator = 'misskey',
): Promise<unknown> {
	pendingApiRequestsCount.value++;

	const onFinally = () => {
		pendingApiRequestsCount.value--;
	};

	const query = new URLSearchParams(data as Record<string, string>);

	const promise = new Promise<unknown>((resolve, reject) => {
		// Send request
		const initiateTime = Date.now();
		window.fetch(`${apiUrl}/${endpoint}?${query}`, {
			method: 'GET',
			credentials: 'include',
			headers: {
				'Authorization': 'anonymous',
				'X-Client-Transaction-Id': generateClientTransactionId(initiator),
			},
		}).then(res => {
			if (instance.googleAnalyticsId) {
				gtagTime({
					event_category: 'api-get',
					event_label: `/${endpoint}?${query}`,
					value: Date.now() - initiateTime,
				});
			}
			return res;
		}).then(handleResponse(resolve, reject)).catch(reject);
	});

	promise.then(onFinally, onFinally);

	return promise;
}
