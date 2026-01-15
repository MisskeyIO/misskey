<script lang="ts" setup>
import { ref } from 'nativescript-vue';
import type * as Misskey from 'misskey-js';
import { clearInstanceUrl, getAnonymousClient, session, signInWithToken } from '../state/session';
import { getPasskeyAssertion, isPasskeySupported } from '../services/passkey';

const step = ref<'username' | 'password' | 'totp'>('username');
const username = ref('');
const password = ref('');
const totp = ref('');
const busy = ref(false);
const error = ref('');
const notice = ref('');
const needCaptcha = ref(false);

const passkeyAvailable = ref(isPasskeySupported());

function resetNotices() {
  error.value = '';
  notice.value = '';
}

function formatSigninError(err: unknown): string {
  const apiError = err as Misskey.api.APIError | undefined;
  switch (apiError?.id) {
    case '6cc579cc-885d-43d8-95c2-b8c7fc963280':
      return 'No such user.';
    case '932c904e-9460-45b7-9ce6-7ed33be7eb2c':
      return 'Credentials verification failed.';
    case 'e03a5f46-d309-4865-9b69-56282d94e1eb':
      return 'This account is suspended.';
    case '22d05606-fbcf-421a-a2db-b32610dcfd1b':
      return 'Rate limit exceeded. Try again later.';
    case 'cdf1235b-ac71-46d4-a3a6-84ccce48df6f':
      return 'Invalid TOTP code.';
    case '36b96a7d-b547-412d-aeed-2d611cdc8cdc':
      return 'Unknown passkey.';
    case '93b86c4b-72f9-40eb-9815-798928603d1e':
    case 'b18c89a7-5b5e-4cec-bb5b-0419f332d430':
      return 'Passkey verification failed.';
    case '2d84773e-f7b7-4d0b-8f72-bb69b584c912':
      return 'Passkey verified, but passwordless login is disabled.';
    default:
      return apiError?.message ?? 'Sign-in failed.';
  }
}

async function handlePasskeyAssertion(
  authRequest: Misskey.entities.SigninFlowResponse & { next: 'passkey' },
) {
  try {
    const credential = await getPasskeyAssertion(authRequest.authRequest as any);
    await runSigninFlow({ credential });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Passkey authentication failed.';
    step.value = 'totp';
  }
}

async function runSigninFlow(req: Partial<Misskey.entities.SigninFlowRequest>) {
  if (!session.instanceUrl) {
    throw new Error('Instance not configured');
  }

  const client = getAnonymousClient();
  const response = await client.request('signin-flow', {
    username: username.value,
    ...req,
  } as Misskey.entities.SigninFlowRequest);

  if (response.finished) {
    await signInWithToken(response.i);
    return;
  }

  switch (response.next) {
    case 'captcha':
      needCaptcha.value = true;
      notice.value = 'Captcha required. Mobile captcha support is not wired yet.';
      step.value = 'password';
      break;
    case 'password':
      needCaptcha.value = false;
      step.value = 'password';
      break;
    case 'totp':
      step.value = 'totp';
      break;
    case 'passkey':
      if (passkeyAvailable.value) {
        await handlePasskeyAssertion(response);
      } else {
        notice.value = 'Passkeys are not supported on this device.';
        step.value = 'totp';
      }
      break;
  }
}

async function onPasskeySignIn() {
  resetNotices();
  if (!passkeyAvailable.value) {
    notice.value = 'Passkeys are not supported on this device.';
    return;
  }

  try {
    busy.value = true;
    const client = getAnonymousClient();
    const init = await client.request('signin-with-passkey', {} as Misskey.Endpoints['signin-with-passkey']['req']);
    const assertion = await getPasskeyAssertion(init.option as any);
    const result = await client.request('signin-with-passkey', {
      context: init.context,
      credential: assertion,
    } as Misskey.Endpoints['signin-with-passkey']['req']);

    if (result?.signinResponse?.i) {
      await signInWithToken(result.signinResponse.i);
    } else {
      error.value = 'Passkey sign-in failed.';
    }
  } catch (err) {
    error.value = formatSigninError(err);
  } finally {
    busy.value = false;
  }
}

async function onSubmitUsername() {
  resetNotices();
  if (!username.value.trim()) {
    error.value = 'Username is required.';
    return;
  }

  try {
    busy.value = true;
    await runSigninFlow({});
  } catch (err) {
    error.value = formatSigninError(err);
  } finally {
    busy.value = false;
  }
}

async function onSubmitPassword() {
  resetNotices();
  if (!password.value) {
    error.value = 'Password is required.';
    return;
  }

  try {
    busy.value = true;
    await runSigninFlow({
      password: password.value,
    });
  } catch (err) {
    error.value = formatSigninError(err);
  } finally {
    busy.value = false;
  }
}

async function onSubmitTotp() {
  resetNotices();
  if (!totp.value.trim()) {
    error.value = 'TOTP code is required.';
    return;
  }

  try {
    busy.value = true;
    await runSigninFlow({
      password: password.value,
      token: totp.value,
    });
  } catch (err) {
    error.value = formatSigninError(err);
  } finally {
    busy.value = false;
  }
}

function onChangeInstance() {
  clearInstanceUrl();
}
</script>

<template>
  <Page>
    <ActionBar title="Sign In" />
    <ScrollView>
      <StackLayout class="section">
        <Label :text="session.instanceUrl ?? ''" class="muted" />

        <StackLayout v-if="step === 'username'">
          <Label text="Username" class="form-field" />
          <TextField
            v-model="username"
            hint="username or user@domain"
            autocorrect="false"
            autocapitalizationType="none"
            class="form-field"
          />
          <Button :isEnabled="!busy" text="Continue" @tap="onSubmitUsername" />
          <Button v-if="passkeyAvailable" class="secondary" :isEnabled="!busy" text="Sign in with passkey" @tap="onPasskeySignIn" />
        </StackLayout>

        <StackLayout v-else-if="step === 'password'">
          <Label text="Password" class="form-field" />
          <TextField
            v-model="password"
            hint="Password"
            secure="true"
            class="form-field"
          />
          <Label v-if="needCaptcha" text="Captcha required (web login for now)." class="muted" />
          <Button :isEnabled="!busy" text="Sign In" @tap="onSubmitPassword" />
        </StackLayout>

        <StackLayout v-else>
          <Label text="TOTP Code" class="form-field" />
          <TextField
            v-model="totp"
            hint="123456"
            keyboardType="number"
            class="form-field"
          />
          <Button :isEnabled="!busy" text="Verify" @tap="onSubmitTotp" />
        </StackLayout>

        <Label v-if="notice" :text="notice" class="muted" />
        <Label v-if="error" :text="error" class="error" />

        <Button class="secondary" text="Change instance" @tap="onChangeInstance" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>
