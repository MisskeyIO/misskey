import { reactive, computed } from 'nativescript-vue';
import type * as Misskey from 'misskey-js';
import { appStorage } from '../services/storage';
import { createApiClient } from '../services/api';
import { normalizeInstanceUrl } from '../services/instance';
import { closeStream } from '../services/streaming';
import { DEFAULT_INSTANCE_URL } from '../config/build';

export type AccountWithToken = Misskey.entities.MeDetailed & { token: string };

type SessionState = {
  instanceUrl: string | null;
  account: AccountWithToken | null;
  initialized: boolean;
};

const storedInstance = appStorage.getString('instanceUrl');
const fallbackInstance = DEFAULT_INSTANCE_URL?.trim() || null;
const storedAccount = appStorage.getJson<AccountWithToken>('account');

export const session = reactive<SessionState>({
  instanceUrl: storedInstance ?? fallbackInstance,
  account: storedAccount,
  initialized: true,
});

let apiClient: Misskey.api.APIClient | null = null;

function buildClient(credential?: string | null, forceAnonymous = false) {
  if (!session.instanceUrl) {
    throw new Error('Instance not configured');
  }
  const effectiveCredential = forceAnonymous ? null : (credential ?? session.account?.token ?? null);
  apiClient = createApiClient(session.instanceUrl, effectiveCredential);
  return apiClient;
}

export function getApiClient(): Misskey.api.APIClient {
  return apiClient ?? buildClient();
}

export function getAnonymousClient(): Misskey.api.APIClient {
  return buildClient(null, true);
}

export function hasAccount() {
  return session.account != null;
}

export function displayName() {
  return session.account?.name || session.account?.username || 'Unknown';
}

export function setInstanceUrl(input: string) {
  const normalized = normalizeInstanceUrl(input);
  session.instanceUrl = normalized;
  appStorage.setString('instanceUrl', normalized);
  session.account = null;
  appStorage.remove('account');
  closeStream();
  apiClient = null;
}

export function clearInstanceUrl() {
  session.instanceUrl = null;
  appStorage.remove('instanceUrl');
  session.account = null;
  appStorage.remove('account');
  closeStream();
  apiClient = null;
}

export async function signInWithToken(token: string) {
  if (!session.instanceUrl) throw new Error('Instance not configured');

  const client = createApiClient(session.instanceUrl, token);
  const me = await client.request('i', {} as Misskey.Endpoints['i']['req']);
  const account: AccountWithToken = {
    ...(me as Misskey.entities.MeDetailed),
    token,
  };

  session.account = account;
  appStorage.setJson('account', account);
  apiClient = createApiClient(session.instanceUrl, token);
}

export function signOut() {
  session.account = null;
  appStorage.remove('account');
  closeStream();
  apiClient = null;
}

export const isSignedIn = computed(() => session.account != null);
