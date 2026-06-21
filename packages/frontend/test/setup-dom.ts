/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { vi } from 'vitest';

if (!window.matchMedia) {
	vi.stubGlobal('matchMedia', vi.fn((query: string): MediaQueryList => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})));
}

if (!window.ResizeObserver) {
	vi.stubGlobal('ResizeObserver', class ResizeObserver {
		public observe = vi.fn();
		public unobserve = vi.fn();
		public disconnect = vi.fn();
	});
}

if (!window.IntersectionObserver) {
	vi.stubGlobal('IntersectionObserver', class IntersectionObserver {
		public readonly root = null;
		public readonly rootMargin = '';
		public readonly thresholds = [];
		public observe = vi.fn();
		public unobserve = vi.fn();
		public disconnect = vi.fn();
		public takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
	});
}

if (!window.CSS) {
	vi.stubGlobal('CSS', {
		supports: vi.fn(() => false),
	});
} else if (!window.CSS.supports) {
	window.CSS.supports = vi.fn(() => false);
}

if (!('allow' in HTMLIFrameElement.prototype)) {
	Object.defineProperty(HTMLIFrameElement.prototype, 'allow', {
		get(this: HTMLIFrameElement): string {
			return this.getAttribute('allow') ?? '';
		},
		set(this: HTMLIFrameElement, value: string) {
			this.setAttribute('allow', value);
		},
	});
}

if (!('sandbox' in HTMLIFrameElement.prototype)) {
	Object.defineProperty(HTMLIFrameElement.prototype, 'sandbox', {
		get(this: HTMLIFrameElement): Pick<DOMTokenList, 'toString'> {
			return {
				toString: () => this.getAttribute('sandbox') ?? '',
			};
		},
	});
}
