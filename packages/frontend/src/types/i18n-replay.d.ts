/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { ParameterizedString } from 'i18n';

declare module 'i18n' {
	interface Locale {
		saveThisFile: string;
		sensitiveContentConsentTitle: string;
		sensitiveContentConsentAreYouOver18: string;
		displayedContentSettings: string;
		displayOfSensitiveAds: string;
		_displayOfSensitiveAds: {
			hidden: string;
			always: string;
			filtered: string;
		};
		helpUsImproveUserExperience: string;
		pleaseConsentToTracking: ParameterizedString<'host' | 'privacyPolicyUrl'>;
		consentEssential: string;
		consentAll: string;
		consentSelected: string;
		gtagConsentCustomize: string;
		gtagConsentCustomizeDescription: ParameterizedString<'host'>;
		gtagConsentAnalytics: string;
		gtagConsentAnalyticsDescription: string;
		gtagConsentFunctionality: string;
		gtagConsentFunctionalityDescription: string;
		gtagConsentPersonalization: string;
		gtagConsentPersonalizationDescription: string;
		dimension: string;
		dimensionWithNumber: ParameterizedString<'dimension'>;
		dimensionRange: ParameterizedString<'min' | 'max'>;
		dimensionInvalid: string;
		dimensionOutOfRange: ParameterizedString<'min' | 'max'>;
		postingLanguage: string;
		viewingLanguages: string;
		includeUnknownLanguage: string;
		includeRemoteLanguage: string;
		showMediaInAllLanguages: string;
		showHashtagsInAllLanguages: string;
		timelineCache: string;
		timelineCacheDescription: string;
		purgeHomeTimelineCache: string;
		purgeUserTimelineCache: string;
		purgeUserListTimelineCache: string;
		purgeAntennaTimelineCache: string;
		purgeTimelineCacheConfirm: string;
		deleteAccountConfirmAndWarn: string;
		accountStats: string;
		securityInfo: string;
		twoFactorEnabled: string;
		securityKeys: string;
	}
}

export {};
