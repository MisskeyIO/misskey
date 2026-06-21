declare module 'reconnecting-websocket/dist/reconnecting-websocket.mjs' {
	import type { Options, UrlProvider } from 'reconnecting-websocket';

	// eslint-disable-next-line import/no-default-export
	export default class ReconnectingWebSocket {
		constructor(url: UrlProvider, protocols?: string | string[], options?: Options);

		binaryType: BinaryType;
		addEventListener(type: 'open' | 'close', listener: () => void): void;
		addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
		send(data: string): void;
		close(): void;
	}
}
