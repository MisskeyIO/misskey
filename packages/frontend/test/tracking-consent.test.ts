/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Misskey from 'misskey-js';
import './init';

const analyticsMocks = vi.hoisted(() => {
	const identify = vi.fn<() => Promise<void>>(() => Promise.resolve());
	const page = vi.fn<() => Promise<void>>(() => Promise.resolve());
	const analyticsFactory = vi.fn(() => ({
		identify,
		page,
	}));
	const googleAnalyticsPlugin = vi.fn(() => ({
		name: 'google-analytics',
	}));

	return {
		identify,
		page,
		analyticsFactory,
		googleAnalyticsPlugin,
	};
});

const bootMocks = vi.hoisted(() => {
	return {
		instance: {
			googleAnalyticsMeasurementId: null as string | null,
		},
		popup: vi.fn(() => ({
			dispose: vi.fn(),
		})),
	};
});

vi.mock('analytics', () => ({
	default: analyticsMocks.analyticsFactory,
}));

vi.mock('@analytics/google-analytics', () => ({
	default: analyticsMocks.googleAnalyticsPlugin,
}));

vi.mock('@/instance.js', () => ({
	instance: bootMocks.instance,
	fetchInstance: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/os.js', () => ({
	alert: vi.fn(),
	confirm: vi.fn(),
	popup: bootMocks.popup,
	post: vi.fn(),
}));

vi.mock('@/i18n.js', () => ({
	i18n: {
		ts: {},
		tsx: {},
	},
	updateI18n: vi.fn(),
}));

vi.mock('@/boot/common.js', () => ({
	common: vi.fn(() => Promise.resolve({
		isClientUpdated: false,
		lastVersion: null,
		app: {},
	})),
}));

vi.mock('@/stream.js', () => ({
	useStream: vi.fn(() => ({
		on: vi.fn(),
	})),
}));

vi.mock('@/utility/sound.js', () => ({}));

vi.mock('@/i.js', () => ({
	$i: undefined,
}));

vi.mock('@/store.js', () => ({
	store: {
		loaded: Promise.resolve(),
		s: {
			accountSetupWizard: -1,
			realtimeMode: false,
		},
	},
}));

vi.mock('@/utility/reaction-picker.js', () => ({
	reactionPicker: {
		init: vi.fn(),
	},
}));

vi.mock('@/utility/initialize-sw.js', () => ({
	initializeSw: vi.fn(),
}));

vi.mock('@/utility/emoji-picker.js', () => ({
	emojiPicker: {
		init: vi.fn(),
	},
}));

vi.mock('@/router.js', () => ({
	mainRouter: {},
}));

vi.mock('@/utility/hotkey.js', () => ({
	makeHotkey: vi.fn(),
}));

vi.mock('@/custom-emojis.js', () => ({
	addCustomEmoji: vi.fn(),
	removeCustomEmojis: vi.fn(),
	updateCustomEmojis: vi.fn(),
}));

vi.mock('@/accounts.js', () => ({
	updateCurrentAccountPartial: vi.fn(),
}));

vi.mock('@/pref-migrate.js', () => ({
	migrateOldSettings: vi.fn(),
}));

vi.mock('@/utility/unison-reload.js', () => ({
	unisonReload: vi.fn(),
}));

vi.mock('@/utility/is-birthday.js', () => ({
	isBirthday: vi.fn(() => false),
}));

vi.mock('@/utility/achievements.js', () => ({
	claimAchievement: vi.fn(),
	claimedAchievements: [],
}));

const meta = (googleAnalyticsMeasurementId: string | null = 'G-TEST'): Misskey.entities.MetaDetailed => ({
	googleAnalyticsMeasurementId,
} as Misskey.entities.MetaDetailed);

const loadAnalyticsModule = async () => {
	vi.resetModules();
	return await import('@/analytics.js');
};

const loadTrackingUserPropertiesModule = async () => {
	vi.resetModules();
	return await import('@/utility/tracking-user-properties.js');
};

const loadMainBootModule = async () => {
	vi.resetModules();
	return await import('@/boot/main-boot.js');
};

describe('tracking consent', () => {
	beforeEach(() => {
		window.localStorage.clear();
		analyticsMocks.identify.mockClear();
		analyticsMocks.page.mockClear();
		analyticsMocks.analyticsFactory.mockClear();
		analyticsMocks.googleAnalyticsPlugin.mockClear();
		bootMocks.popup.mockClear();
		bootMocks.instance.googleAnalyticsMeasurementId = null;
		Reflect.deleteProperty(window, 'gtag');
		Reflect.deleteProperty(window, 'dataLayer');
	});

	afterEach(() => {
		window.localStorage.clear();
	});

	test.each([
		['absent', null],
		['false', 'false'],
	])('analytics initialization, identify, and page are skipped when gaConsent is %s', async (_label, consent) => {
		if (consent !== null) window.localStorage.setItem('gaConsent', consent);
		const { sendInitialAnalyticsPageView } = await loadAnalyticsModule();

		await sendInitialAnalyticsPageView(meta(), 'user-1', '/timeline');

		expect(analyticsMocks.googleAnalyticsPlugin).not.toHaveBeenCalled();
		expect(analyticsMocks.analyticsFactory).not.toHaveBeenCalled();
		expect(analyticsMocks.identify).not.toHaveBeenCalled();
		expect(analyticsMocks.page).not.toHaveBeenCalled();
	});

	test('analytics initialization, identify, and page run when consent is granted and GA is configured', async () => {
		window.localStorage.setItem('gaConsent', 'true');
		const { sendInitialAnalyticsPageView } = await loadAnalyticsModule();

		await sendInitialAnalyticsPageView(meta(), 'user-1', '/timeline');

		expect(analyticsMocks.googleAnalyticsPlugin).toHaveBeenCalledWith({
			measurementIds: ['G-TEST'],
			debug: true,
		});
		expect(analyticsMocks.analyticsFactory).toHaveBeenCalledOnce();
		expect(analyticsMocks.identify).toHaveBeenCalledWith('user-1');
		expect(analyticsMocks.page).toHaveBeenCalledWith({
			path: '/timeline',
		});
	});

	test('setUserProperties only sends GA user properties when ad_user_data is granted', async () => {
		bootMocks.instance.googleAnalyticsMeasurementId = 'G-TEST';
		const gtag = vi.fn();
		Object.assign(window, { gtag });
		window.localStorage.setItem('gtagConsent', JSON.stringify({
			ad_user_data: 'denied',
		}));
		const { setUserProperties } = await loadTrackingUserPropertiesModule();

		setUserProperties({
			device_id: 'device-1',
		});
		expect(gtag).not.toHaveBeenCalled();

		window.localStorage.setItem('gtagConsent', JSON.stringify({
			ad_user_data: 'granted',
		}));
		setUserProperties({
			device_id: 'device-1',
		});

		expect(gtag).toHaveBeenCalledWith('set', 'user_properties', {
			device_id: 'device-1',
		});
	});

	test('setGtag emits a direct user_properties set call', async () => {
		const gtag = vi.fn();
		Object.assign(window, { gtag });
		const { setGtag } = await import('@/utility/gtag.js');

		setGtag({
			device_id: 'device-1',
		});

		expect(gtag).toHaveBeenCalledWith('set', 'user_properties', {
			device_id: 'device-1',
		});
	});

	test('startup offers the tracking consent popup when GA is configured and gaConsent is unset', async () => {
		bootMocks.instance.googleAnalyticsMeasurementId = 'G-TEST';
		const { showTrackingConsentIfNeeded, TrackingConsentPopup } = await loadMainBootModule();

		showTrackingConsentIfNeeded();

		expect(bootMocks.popup).toHaveBeenCalledWith(TrackingConsentPopup, {}, expect.objectContaining({
			closed: expect.any(Function),
		}));
	});

	test('startup does not offer the tracking consent popup when consent is already set', async () => {
		bootMocks.instance.googleAnalyticsMeasurementId = 'G-TEST';
		window.localStorage.setItem('gaConsent', 'false');
		const { showTrackingConsentIfNeeded } = await loadMainBootModule();

		showTrackingConsentIfNeeded();

		assert.strictEqual(bootMocks.popup.mock.calls.length, 0);
	});
});
