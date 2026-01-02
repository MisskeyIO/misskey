import { Application, isAndroid, isIOS } from '@nativescript/core';
import { session } from '../state/session';

type Base64UrlString = string;

export type PublicKeyCredentialRequestOptionsJSON = {
  challenge: Base64UrlString;
  rpId?: string;
  allowCredentials?: { id: Base64UrlString; type: 'public-key' }[];
  userVerification?: 'required' | 'preferred' | 'discouraged';
};

export type PublicKeyCredentialCreationOptionsJSON = {
  challenge: Base64UrlString;
  rp: { id?: string; name?: string };
  user: { id: Base64UrlString; name?: string; displayName?: string };
  pubKeyCredParams?: { type: 'public-key'; alg: number }[];
  excludeCredentials?: { id: Base64UrlString; type: 'public-key' }[];
  authenticatorSelection?: {
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  attestation?: string;
};

export type AuthenticationResponseJSON = {
  id: Base64UrlString;
  rawId: Base64UrlString;
  type: 'public-key';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  response: {
    authenticatorData: Base64UrlString;
    clientDataJSON: Base64UrlString;
    signature: Base64UrlString;
    userHandle?: Base64UrlString;
  };
};

export type RegistrationResponseJSON = {
  id: Base64UrlString;
  rawId: Base64UrlString;
  type: 'public-key';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  response: {
    attestationObject: Base64UrlString;
    clientDataJSON: Base64UrlString;
    transports?: string[];
  };
};

export function isPasskeySupported(): boolean {
  if (isIOS) {
    return typeof ASAuthorizationPlatformPublicKeyCredentialProvider !== 'undefined';
  }
  if (isAndroid) {
    return typeof androidx !== 'undefined' && typeof androidx.credentials !== 'undefined';
  }
  return false;
}

export function getPasskeyAssertion(
  options: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResponseJSON> {
  if (isIOS) {
    return getPasskeyAssertionIOS(options);
  }
  if (isAndroid) {
    return getPasskeyAssertionAndroid(options);
  }
  return Promise.reject(new Error('Passkeys not supported on this platform.'));
}

export function createPasskeyCredential(
  options: PublicKeyCredentialCreationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  if (isIOS) {
    return createPasskeyCredentialIOS(options);
  }
  if (isAndroid) {
    return createPasskeyCredentialAndroid(options);
  }
  return Promise.reject(new Error('Passkeys not supported on this platform.'));
}

// iOS implementation

function base64UrlToNSData(value: string): NSData {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const data = NSData.alloc().initWithBase64EncodedStringOptions(padded, 0);
  if (!data) {
    throw new Error('Invalid base64 data.');
  }
  return data;
}

function nsDataToBase64Url(data: NSData | null): string {
  if (!data) return '';
  const base64 = data.base64EncodedStringWithOptions(0);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

@NativeClass()
class PasskeyAuthorizationDelegate extends NSObject implements ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
  public static ObjCProtocols = [ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding];

  private resolveFn?: (value: AuthenticationResponseJSON | RegistrationResponseJSON) => void;
  private rejectFn?: (reason?: unknown) => void;

  public initWithResolveReject(
    resolve: (value: AuthenticationResponseJSON | RegistrationResponseJSON) => void,
    reject: (reason?: unknown) => void,
  ) {
    this.resolveFn = resolve;
    this.rejectFn = reject;
    return this;
  }

  public authorizationControllerDidCompleteWithAuthorization(
    controller: ASAuthorizationController,
    authorization: ASAuthorization,
  ) {
    const credential = authorization.credential;

    if (credential instanceof ASAuthorizationPlatformPublicKeyCredentialAssertion) {
      const result: AuthenticationResponseJSON = {
        id: nsDataToBase64Url(credential.credentialID),
        rawId: nsDataToBase64Url(credential.credentialID),
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: {
          authenticatorData: nsDataToBase64Url(credential.rawAuthenticatorData),
          clientDataJSON: nsDataToBase64Url(credential.rawClientDataJSON),
          signature: nsDataToBase64Url(credential.signature),
          userHandle: nsDataToBase64Url(credential.userID),
        },
      };

      this.resolveFn?.(result);
      return;
    }

    if (credential instanceof ASAuthorizationPlatformPublicKeyCredentialRegistration) {
      const result: RegistrationResponseJSON = {
        id: nsDataToBase64Url(credential.credentialID),
        rawId: nsDataToBase64Url(credential.credentialID),
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: {
          attestationObject: nsDataToBase64Url(credential.rawAttestationObject),
          clientDataJSON: nsDataToBase64Url(credential.rawClientDataJSON),
          transports: ['internal'],
        },
      };

      this.resolveFn?.(result);
      return;
    }

    this.rejectFn?.(new Error('Unexpected credential type.'));
  }

  public authorizationControllerDidCompleteWithError(
    controller: ASAuthorizationController,
    error: NSError,
  ) {
    this.rejectFn?.(new Error(error?.localizedDescription || 'Passkey failed.'));
  }

  public presentationAnchorForController(controller: ASAuthorizationController): ASPresentationAnchor {
    return UIApplication.sharedApplication.keyWindow ?? UIApplication.sharedApplication.windows.firstObject;
  }
}

function getPasskeyAssertionIOS(
  options: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResponseJSON> {
  return new Promise((resolve, reject) => {
    try {
      const rpId = options.rpId ?? sessionRpIdFallback();
      if (!rpId) throw new Error('Missing rpId for passkey request.');

      const provider = ASAuthorizationPlatformPublicKeyCredentialProvider.alloc().initWithRelyingPartyIdentifier(rpId);
      const request = provider.createCredentialAssertionRequestWithChallenge(base64UrlToNSData(options.challenge));

      if (options.allowCredentials?.length) {
        const allowed = options.allowCredentials.map((cred) =>
          ASAuthorizationPlatformPublicKeyCredentialDescriptor.alloc().initWithCredentialID(base64UrlToNSData(cred.id)),
        );
        request.allowedCredentials = allowed;
      }

      const controller = ASAuthorizationController.alloc().initWithAuthorizationRequests([request]);
      const delegate = PasskeyAuthorizationDelegate.alloc().initWithResolveReject(resolve, reject);
      controller.delegate = delegate;
      controller.presentationContextProvider = delegate;
      controller.performRequests();
    } catch (err) {
      reject(err);
    }
  });
}

function createPasskeyCredentialIOS(
  options: PublicKeyCredentialCreationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  return new Promise((resolve, reject) => {
    try {
      const rpId = options.rp?.id ?? sessionRpIdFallback();
      if (!rpId) throw new Error('Missing rpId for passkey request.');

      const provider = ASAuthorizationPlatformPublicKeyCredentialProvider.alloc().initWithRelyingPartyIdentifier(rpId);
      const userName = options.user.name ?? options.user.displayName ?? 'User';
      const request = provider.createCredentialRegistrationRequestWithChallengeNameUserID(
        base64UrlToNSData(options.challenge),
        userName,
        base64UrlToNSData(options.user.id),
      );

      if (options.excludeCredentials?.length && typeof ASAuthorizationPlatformPublicKeyCredentialDescriptor !== 'undefined') {
        const excluded = options.excludeCredentials.map((cred) =>
          ASAuthorizationPlatformPublicKeyCredentialDescriptor.alloc().initWithCredentialID(base64UrlToNSData(cred.id)),
        );
        request.excludedCredentials = excluded;
      }

      const controller = ASAuthorizationController.alloc().initWithAuthorizationRequests([request]);
      const delegate = PasskeyAuthorizationDelegate.alloc().initWithResolveReject(resolve, reject);
      controller.delegate = delegate;
      controller.presentationContextProvider = delegate;
      controller.performRequests();
    } catch (err) {
      reject(err);
    }
  });
}

// Android implementation

function getAndroidActivity(): android.app.Activity {
  const activity = Application.android.foregroundActivity || Application.android.startActivity;
  if (!activity) {
    throw new Error('No Android activity available.');
  }
  return activity as android.app.Activity;
}

function getPasskeyAssertionAndroid(
  options: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResponseJSON> {
  return new Promise((resolve, reject) => {
    try {
      const activity = getAndroidActivity();
      const manager = androidx.credentials.CredentialManager.create(activity);
      const requestJson = JSON.stringify(options);
      const option = new androidx.credentials.GetPublicKeyCredentialOption(requestJson);
      const optionsList = new java.util.ArrayList();
      optionsList.add(option);
      const request = new androidx.credentials.GetCredentialRequest(optionsList);
      const executor = java.util.concurrent.Executors.newSingleThreadExecutor();
      const cancelSignal = new android.os.CancellationSignal();
      const callback = new androidx.credentials.CredentialManagerCallback({
        onResult: (result: androidx.credentials.GetCredentialResponse) => {
          try {
            const credential = result.credential;
            if (credential instanceof androidx.credentials.PublicKeyCredential) {
              const json = credential.authenticationResponseJson;
              resolve(JSON.parse(json));
              return;
            }
            reject(new Error('Unexpected credential type.'));
          } catch (err) {
            reject(err);
          }
        },
        onError: (error: androidx.credentials.exceptions.GetCredentialException) => {
          reject(new Error(error?.getMessage?.() || 'Passkey failed.'));
        },
      });
      manager.getCredentialAsync(activity, request, cancelSignal, executor, callback);
    } catch (err) {
      reject(err);
    }
  });
}

function createPasskeyCredentialAndroid(
  options: PublicKeyCredentialCreationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  return new Promise((resolve, reject) => {
    try {
      const activity = getAndroidActivity();
      const manager = androidx.credentials.CredentialManager.create(activity);
      const requestJson = JSON.stringify(options);
      const request = new androidx.credentials.CreatePublicKeyCredentialRequest(
        requestJson,
        null,
        false,
        null,
        null,
        false,
      );
      const executor = java.util.concurrent.Executors.newSingleThreadExecutor();
      const cancelSignal = new android.os.CancellationSignal();
      const callback = new androidx.credentials.CredentialManagerCallback({
        onResult: (result: androidx.credentials.CreateCredentialResponse) => {
          try {
            if (result instanceof androidx.credentials.CreatePublicKeyCredentialResponse) {
              const json =
                typeof result.getRegistrationResponseJson === 'function'
                  ? result.getRegistrationResponseJson()
                  : result.registrationResponseJson;
              resolve(JSON.parse(json));
              return;
            }
            reject(new Error('Unexpected credential response.'));
          } catch (err) {
            reject(err);
          }
        },
        onError: (error: androidx.credentials.exceptions.CreateCredentialException) => {
          reject(new Error(error?.getMessage?.() || 'Passkey registration failed.'));
        },
      });
      manager.createCredentialAsync(activity, request, cancelSignal, executor, callback);
    } catch (err) {
      reject(err);
    }
  });
}

function sessionRpIdFallback(): string | undefined {
  if (!session.instanceUrl) return undefined;
  try {
    const url = new URL(session.instanceUrl);
    return url.hostname || undefined;
  } catch {
    return undefined;
  }
}
