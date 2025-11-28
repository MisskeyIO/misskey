/*
 * SPDX-FileCopyrightText: Lupo Montero and Contributors of https://github.com/lupomontero/psl
 * SPDX-License-Identifier: MIT
 *
 * This file is derived from the project that has licensed under the The MIT License.
 * This file SHOULD NOT be considered as a part of this project that has licensed under AGPL-3.0-only
 * Adapted from https://github.com/lupomontero/psl/blob/2a3d53f3ba63c6e503da54b835a8dcac681668cd/types/index.d.ts
 */

declare module 'psl' {
	/**
	 * Result returned when a given domain name was not parsable (not exported)
	 */
	export type ErrorResult<T extends keyof errorCodes> = {
		input: string;
		error: {
			code: T;
			message: errorCodes[T];
		};
	};

	/**
	 * Error codes and descriptions for domain name parsing errors
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	export const enum errorCodes {
		DOMAIN_TOO_SHORT = 'Domain name too short',
		DOMAIN_TOO_LONG = 'Domain name too long. It should be no more than 255 chars.',
		LABEL_STARTS_WITH_DASH = 'Domain name label can not start with a dash.',
		LABEL_ENDS_WITH_DASH = 'Domain name label can not end with a dash.',
		LABEL_TOO_LONG = 'Domain name label should be at most 63 chars long.',
		LABEL_TOO_SHORT = 'Domain name label should be at least 1 character long.',
		LABEL_INVALID_CHARS = 'Domain name label can only contain alphanumeric characters or dashes.'
	}

	export type ParsedDomain = {
		input: string;
		tld: string | null;
		sld: string | null;
		domain: string | null;
		subdomain: string | null;
		listed: boolean;
	};

	/**
	 * Parse a domain name and return its components
	 */
	export function parse(input: string): ParsedDomain | ErrorResult<keyof errorCodes>;

	/**
	 * Get the base domain for full domain name
	 */
	export function get(domain: string): string | null;

	/**
	 * Check whether the given domain belongs to a known public suffix
	 */
	export function isValid(domain: string): boolean;

	/**
	 * An array of TLDs used to parse domains.
	 */
	export const rules: string[];
}
