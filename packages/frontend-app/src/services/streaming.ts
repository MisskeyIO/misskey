import { Stream } from 'misskey-js';

let stream: Stream | null = null;
let activeOrigin: string | null = null;
let activeToken: string | null = null;

export function ensureStream(origin: string, token: string): Stream {
  if (stream && activeOrigin === origin && activeToken === token) {
    return stream;
  }

  if (stream) {
    stream.close();
  }

  activeOrigin = origin;
  activeToken = token;
  stream = new Stream(origin, { token });
  return stream;
}

export function closeStream(): void {
  if (stream) {
    stream.close();
  }
  stream = null;
  activeOrigin = null;
  activeToken = null;
}
