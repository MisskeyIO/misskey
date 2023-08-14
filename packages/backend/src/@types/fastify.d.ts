/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import FastifyReply from "fastify";

declare module 'fastify' {
  interface FastifyReply {
    cspNonce: {
        script: string
    }
  }
}
