import type { FastifyRequest } from 'fastify';

export type CorsDecision = {
	origin: boolean | string;
	credentials: boolean;
};

export function decideCorsOptions(
	request: FastifyRequest,
): CorsDecision {
	const hasCookie = Object.keys(request.cookies).length > 0;
	const hasTransactionId = request.headers['x-client-transaction-id'] !== undefined;

	if (!hasCookie && !hasTransactionId) {
		return {
			origin: '*',
			credentials: false,
		} satisfies CorsDecision;
	}

	return {
		origin: true,
		credentials: true,
	} satisfies CorsDecision;
}
