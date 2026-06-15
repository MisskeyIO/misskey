/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

declare module '@authenio/samlify-node-xmllint' {
  export function validate(response: string): Promise<string>;
}
