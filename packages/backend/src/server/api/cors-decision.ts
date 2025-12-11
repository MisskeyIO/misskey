import type { FastifyRequest } from 'fastify';

export type CorsDecision = {
	origin: boolean | string;
	credentials: boolean;
};

export function decideCorsOptions(
	request: FastifyRequest,
	configUrl: string,
): CorsDecision {
	const hasCookie = Object.keys(request.cookies).length > 0;
	const hasTransactionId = request.headers['x-client-transaction-id'] !== undefined;

	if (!hasCookie && !hasTransactionId) {
		return {
			origin: '*',
			credentials: false,
		} satisfies CorsDecision;
	}

	const requestOrigin = request.headers.origin
		?? (['GET', 'HEAD'].includes(request.method) ? request.headers.referer : undefined);
	if (!requestOrigin || !`${requestOrigin}/`.startsWith(configUrl + '/')) {
		return {
			origin: true,
			credentials: false,
		} satisfies CorsDecision;
	}

	return {
		origin: configUrl,
		credentials: true,
	} satisfies CorsDecision;
}
