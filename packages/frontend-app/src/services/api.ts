import { APIClient } from 'misskey-js';

export function createApiClient(origin: string, credential?: string | null): APIClient {
  return new APIClient({
    origin,
    credential: credential ?? undefined,
  });
}
