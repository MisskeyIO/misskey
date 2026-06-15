/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

declare module '@analytics/google-analytics' {
	import type { AnalyticsPlugin } from 'analytics';

	type GoogleAnalyticsPluginOptions = {
		measurementIds: string[];
		debug?: boolean;
	};

	export default function googleAnalytics(options: GoogleAnalyticsPluginOptions): AnalyticsPlugin;
}
