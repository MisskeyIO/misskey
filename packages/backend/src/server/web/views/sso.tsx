/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { CommonProps } from '@/server/web/views/_.js';
import { Layout } from '@/server/web/views/base.js';

export function SsoPage(props: CommonProps<{
  transactionId: string;
  serviceName: string;
  kind: 'jwt' | 'saml';
  prompt: string;
}>) {
  function metaBlock() {
    return (
      <>
        <meta name="misskey:sso:transaction-id" content={props.transactionId} />
        <meta name="misskey:sso:service-name" content={props.serviceName} />
        <meta name="misskey:sso:kind" content={props.kind} />
        <meta name="misskey:sso:prompt" content={props.prompt} />
      </>
    );
  }

  return (
    <Layout
      {...props}
      metaSlot={metaBlock()}
    >
    </Layout>
  );
}
