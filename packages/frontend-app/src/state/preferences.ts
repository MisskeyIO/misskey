import { reactive } from 'nativescript-vue';
import { appStorage } from '../services/storage';

export type TimelineMode = 'home' | 'local' | 'hybrid' | 'global';
export type ComposeVisibility = 'public' | 'home' | 'followers';

export type Preferences = {
  timelineMode: TimelineMode;
  timelineWithRenotes: boolean;
  timelineWithReplies: boolean;
  timelineWithFiles: boolean;
  composeVisibility: ComposeVisibility;
  composeLocalOnly: boolean;
  composeUseCw: boolean;
};

const defaults: Preferences = {
  timelineMode: 'home',
  timelineWithRenotes: true,
  timelineWithReplies: true,
  timelineWithFiles: false,
  composeVisibility: 'public',
  composeLocalOnly: false,
  composeUseCw: false,
};

const stored = appStorage.getJson<Partial<Preferences>>('preferences') ?? {};

export const preferences = reactive<Preferences>({
  ...defaults,
  ...stored,
});

export function updatePreferences(partial: Partial<Preferences>) {
  Object.assign(preferences, partial);
  appStorage.setJson('preferences', preferences);
}
