import { ApplicationSettings } from '@nativescript/core';

type StorageKey =
  | 'instanceUrl'
  | 'account'
  | 'preferences';

export const appStorage = {
  getString(key: StorageKey): string | null {
    return ApplicationSettings.getString(key, null);
  },
  setString(key: StorageKey, value: string): void {
    ApplicationSettings.setString(key, value);
  },
  remove(key: StorageKey): void {
    ApplicationSettings.remove(key);
  },
  getJson<T>(key: StorageKey): T | null {
    const raw = ApplicationSettings.getString(key, null);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJson<T>(key: StorageKey, value: T): void {
    ApplicationSettings.setString(key, JSON.stringify(value));
  },
};
