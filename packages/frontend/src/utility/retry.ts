export type RetryOptions = {
	maxAttempts: number;
	initialDelayMs: number;
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function retryWithFibonacciBackoff<T>(
	task: () => Promise<T>,
	options: RetryOptions,
): Promise<T> {
	let nextDelayMultiplier = 1;
	let followingDelayMultiplier = 2;

	for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
		try {
			return await task();
		} catch (error) {
			if (attempt >= options.maxAttempts) {
				throw error;
			}

			const delay = nextDelayMultiplier * options.initialDelayMs;
			await sleep(delay);
			[nextDelayMultiplier, followingDelayMultiplier] = [
				followingDelayMultiplier,
				nextDelayMultiplier + followingDelayMultiplier,
			];
		}
	}

	throw new Error('Retry attempts exhausted.');
}
