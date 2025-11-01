/* eslint-disable */

/*
 * SPDX-FileCopyrightText: Pedro Ladaria and Contributors of https://github.com/pladaria/reconnecting-websocket
 * SPDX-License-Identifier: MIT
 *
 * This file is derived from the project that has licensed under the The MIT License.
 * This file SHOULD NOT be considered as a part of this project that has licensed under AGPL-3.0-only
 * Adapted from https://github.com/pladaria/reconnecting-websocket/blob/05a2f7cb0e31f15dff5ff35ad53d07b1bec5e197/events.ts
 */

export class Event {
	public target: any;
	public type: string;
	constructor(type: string, target: any) {
		this.target = target;
		this.type = type;
	}
}

export class ErrorEvent extends Event {
	public message: string;
	public error: Error;
	constructor(error: Error, target: any) {
		super('error', target);
		this.message = error.message;
		this.error = error;
	}
}

export class CloseEvent extends Event {
	public code: number;
	public reason: string;
	public wasClean = true;
	constructor(code = 1000, reason = '', target: any) {
		super('close', target);
		this.code = code;
		this.reason = reason;
	}
}
export interface WebSocketEventMap {
	close: CloseEvent;
	error: ErrorEvent;
	message: MessageEvent;
	open: Event;
}

export interface WebSocketEventListenerMap {
	close: (event: CloseEvent) => void | {handleEvent: (event: CloseEvent) => void};
	error: (event: ErrorEvent) => void | {handleEvent: (event: ErrorEvent) => void};
	message: (event: MessageEvent) => void | {handleEvent: (event: MessageEvent) => void};
	open: (event: Event) => void | {handleEvent: (event: Event) => void};
}
