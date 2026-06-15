/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import * as saml from 'samlify';
import * as samlValidator from '@authenio/samlify-node-xmllint';
import bodyParser from 'body-parser';
import fastifyCors from '@fastify/cors';
import fastifyExpress from '@fastify/express';
import { create } from 'xmlbuilder2';
import { exportPKCS8, importJWK } from 'jose';
import { IsNull, Not } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { Config } from '@/config.js';
import type { MiSingleSignOnServiceProvider } from '@/models/SingleSignOnServiceProvider.js';
import type { SingleSignOnServiceProvidersRepository, UserProfilesRepository } from '@/models/_.js';
import { LoggerService } from '@/core/LoggerService.js';
import { HtmlTemplateService } from '@/server/web/HtmlTemplateService.js';
import { SsoPage } from '@/server/web/views/sso.js';
import Logger from '@/logger.js';
import { SsoRuntimeService, type SsoUserProfileClaims } from './SsoRuntimeService.js';
import type { FastifyInstance } from 'fastify';
import type { CryptoKey, JWK, KeyObject } from 'jose';
import type { FlowResult } from 'samlify/types/src/flow.js';
import type { BindingContext, RequestInfo } from 'samlify/types/src/types.js';

type XmlNode = Record<string, unknown>;

interface SamlRequestBody {
  [key: string]: string | undefined;
  SAMLRequest?: string;
  RelayState?: string;
  prompt?: string;
}

interface SamlAuthorizeBody {
  transaction_id?: string;
  login_token?: string;
}

interface SamlTransaction {
  serviceId: string;
  flowResult: FlowResult;
  relayState?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSamlTransaction(value: unknown): value is SamlTransaction {
  return isRecord(value)
    && typeof value.serviceId === 'string'
    && isRecord(value.flowResult)
    && typeof value.flowResult.samlContent === 'string'
    && isRecord(value.flowResult.extract)
    && (value.relayState === undefined || typeof value.relayState === 'string');
}

function isJwk(value: unknown): value is JWK {
  return isRecord(value) && typeof value.kty === 'string';
}

function getRequestId(flowResult: FlowResult): string {
  const request = flowResult.extract.request;
  if (isRecord(request) && typeof request.id === 'string') return request.id;
  return '';
}

function stripCertificate(certificate: string): string {
  return certificate.replace(/-----(?:BEGIN|END) CERTIFICATE-----|\s/g, '');
}

function createXmlDocument(nodes: XmlNode, prettyPrint: boolean): string {
  return create({ version: '1.0', encoding: 'UTF-8', standalone: false }, nodes).end({ prettyPrint });
}

async function getSamlPrivateKey(privateKey: string, algorithm: string): Promise<string | Buffer> {
  const trimmed = privateKey.trim();
  if (!trimmed.startsWith('{')) return trimmed;

  const parsed: unknown = JSON.parse(trimmed);
  if (!isJwk(parsed)) throw new Error('Invalid JWK key material');
  const key = await importJWK(parsed, algorithm, { extractable: true });
  if (key instanceof Uint8Array) throw new Error('SAML private key must be an asymmetric key');
  return await exportPKCS8(key as CryptoKey | KeyObject);
}

export function createSamlIdPMetadataXml(provider: MiSingleSignOnServiceProvider, baseUrl: string): string {
  const validUntil = new Date(provider.createdAt.getTime());
  validUntil.setFullYear(validUntil.getFullYear() + 10);

  return createXmlDocument({
    'md:EntityDescriptor': {
      '@xmlns:md': 'urn:oasis:names:tc:SAML:2.0:metadata',
      '@entityID': `${baseUrl}/sso/saml/${provider.id}/metadata`,
      '@validUntil': validUntil.toISOString(),
      'md:IDPSSODescriptor': {
        '@WantAuthnRequestsSigned': provider.wantAuthnRequestsSigned,
        '@protocolSupportEnumeration': 'urn:oasis:names:tc:SAML:2.0:protocol',
        'md:KeyDescriptor': {
          '@use': 'signing',
          'ds:KeyInfo': {
            '@xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
            'ds:X509Data': {
              'ds:X509Certificate': stripCertificate(provider.publicKey),
            },
          },
        },
        'md:NameIDFormat': [
          'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        ],
        'md:SingleSignOnService': [
          {
            '@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
            '@Location': `${baseUrl}/sso/saml/${provider.id}`,
          },
          {
            '@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            '@Location': `${baseUrl}/sso/saml/${provider.id}`,
          },
        ],
      },
    },
  }, true);
}

export function createSamlSPMetadataXml(provider: MiSingleSignOnServiceProvider): string {
  const validUntil = new Date(provider.createdAt.getTime());
  validUntil.setFullYear(validUntil.getFullYear() + 10);
  const keyDescriptors: XmlNode[] = [
    {
      '@use': 'signing',
      'ds:KeyInfo': {
        '@xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'ds:X509Data': {
          'ds:X509Certificate': stripCertificate(provider.publicKey),
        },
      },
    },
  ];

  if (provider.cipherAlgorithm) {
    keyDescriptors.push({
      '@use': 'encryption',
      'ds:KeyInfo': {
        '@xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'ds:X509Data': {
          'ds:X509Certificate': stripCertificate(provider.publicKey),
        },
      },
      'md:EncryptionMethod': {
        '@Algorithm': `http://www.w3.org/2001/04/xmlenc#${provider.cipherAlgorithm}`,
      },
    });
  }

  return createXmlDocument({
    'md:EntityDescriptor': {
      '@xmlns:md': 'urn:oasis:names:tc:SAML:2.0:metadata',
      '@entityID': provider.issuer,
      '@validUntil': validUntil.toISOString(),
      'md:SPSSODescriptor': {
        '@AuthnRequestsSigned': provider.wantAuthnRequestsSigned,
        '@WantAssertionsSigned': provider.wantAssertionsSigned,
        '@protocolSupportEnumeration': 'urn:oasis:names:tc:SAML:2.0:protocol',
        'md:KeyDescriptor': keyDescriptors,
        'md:NameIDFormat': [
          'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        ],
        'md:AssertionConsumerService': {
          '@isDefault': 'true',
          '@index': 0,
          '@Binding': provider.binding === 'post'
            ? 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
            : 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
          '@Location': provider.acsUrl,
        },
      },
    },
  }, true);
}

function createSamlAttribute(name: string, type: 'xs:string' | 'xs:boolean' | 'xs:integer', value: string | number | boolean): XmlNode {
  return {
    '@Name': name,
    '@NameFormat': 'urn:oasis:names:tc:SAML:2.0:attrname-format:basic',
    'saml:AttributeValue': {
      '@xsi:type': type,
      '#': value,
    },
  };
}

function createSamlResponseXml(provider: MiSingleSignOnServiceProvider, baseUrl: string, flowResult: FlowResult, claims: SsoUserProfileClaims, userId: string): BindingContext {
  const id = randomUUID();
  const assertionId = randomUUID();
  const nowTime = new Date();
  const expiresAt = new Date(nowTime.getTime() + 5 * 60 * 1000);
  const now = nowTime.toISOString();
  const expires = expiresAt.toISOString();
  const requestId = getRequestId(flowResult);
  const attributes: XmlNode[] = [
    createSamlAttribute('identityprovider', 'xs:string', baseUrl),
    createSamlAttribute('uid', 'xs:string', userId),
    createSamlAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn', 'xs:string', userId),
    createSamlAttribute('firstName', 'xs:string', claims.given_name ?? 'Misskey User'),
    createSamlAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname', 'xs:string', claims.given_name ?? 'Misskey User'),
    createSamlAttribute('lastName', 'xs:string', claims.family_name),
    createSamlAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname', 'xs:string', claims.family_name),
    createSamlAttribute('displayName', 'xs:string', claims.name),
    createSamlAttribute('preferred_username', 'xs:string', claims.preferred_username),
    createSamlAttribute('profile', 'xs:string', claims.profile),
    createSamlAttribute('email', 'xs:string', claims.email),
    createSamlAttribute('email_verified', 'xs:boolean', claims.email_verified),
    createSamlAttribute('mfa_enabled', 'xs:boolean', claims.mfa_enabled),
    createSamlAttribute('updated_at', 'xs:integer', claims.updated_at),
    createSamlAttribute('admin', 'xs:boolean', claims.admin),
    createSamlAttribute('moderator', 'xs:boolean', claims.moderator),
    {
      '@Name': 'roles',
      '@NameFormat': 'urn:oasis:names:tc:SAML:2.0:attrname-format:basic',
      'saml:AttributeValue': claims.roles.map(role => ({
        '@xsi:type': 'xs:string',
        '#': role,
      })),
    },
  ];

  if (claims.picture) attributes.push(createSamlAttribute('picture', 'xs:string', claims.picture));

  return {
    id,
    context: createXmlDocument({
      'samlp:Response': {
        '@xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
        '@xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
        '@ID': id,
        '@Version': '2.0',
        '@IssueInstant': now,
        '@Destination': provider.acsUrl,
        '@InResponseTo': requestId,
        'saml:Issuer': `${baseUrl}/sso/saml/${provider.id}/metadata`,
        'samlp:Status': {
          'samlp:StatusCode': {
            '@Value': 'urn:oasis:names:tc:SAML:2.0:status:Success',
          },
        },
        'saml:Assertion': {
          '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          '@xmlns:xs': 'http://www.w3.org/2001/XMLSchema',
          '@ID': assertionId,
          '@Version': '2.0',
          '@IssueInstant': now,
          'saml:Issuer': `${baseUrl}/sso/saml/${provider.id}/metadata`,
          'saml:Subject': {
            'saml:NameID': {
              '@Format': 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
              '#': claims.email,
            },
            'saml:SubjectConfirmation': {
              '@Method': 'urn:oasis:names:tc:SAML:2.0:cm:bearer',
              'saml:SubjectConfirmationData': {
                '@InResponseTo': requestId,
                '@NotOnOrAfter': expires,
                '@Recipient': provider.acsUrl,
              },
            },
          },
          'saml:Conditions': {
            '@NotBefore': now,
            '@NotOnOrAfter': expires,
            'saml:AudienceRestriction': {
              'saml:Audience': [provider.issuer, ...provider.audience],
            },
          },
          'saml:AuthnStatement': {
            '@AuthnInstant': now,
            '@SessionIndex': assertionId,
            '@SessionNotOnOrAfter': expires,
            'saml:AuthnContext': {
              'saml:AuthnContextClassRef': 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
            },
          },
          'saml:AttributeStatement': {
            'saml:Attribute': attributes,
          },
        },
      },
    }, false),
  };
}

function createError(message: string, code: string, id: string, kind: 'client' | 'server') {
  return { error: { message, code, id, kind } };
}

@Injectable()
export class SAMLIdentifyProviderService {
  #logger: Logger;

  constructor(
    @Inject(DI.config)
    private config: Config,

    @Inject(DI.redis)
    private redisClient: Redis.Redis,

    @Inject(DI.singleSignOnServiceProvidersRepository)
    private singleSignOnServiceProvidersRepository: SingleSignOnServiceProvidersRepository,

    @Inject(DI.userProfilesRepository)
    private userProfilesRepository: UserProfilesRepository,

    private ssoRuntimeService: SsoRuntimeService,
    private loggerService: LoggerService,
    private htmlTemplateService: HtmlTemplateService,
  ) {
    this.#logger = this.loggerService.getLogger('sso:saml');
    saml.setSchemaValidator(samlValidator);
  }

  @bindThis
  private async getProvider(serviceId: string): Promise<MiSingleSignOnServiceProvider | null> {
    return await this.singleSignOnServiceProvidersRepository.findOneBy({ id: serviceId, type: 'saml' });
  }

  @bindThis
  public createIdPMetadataXml(provider: MiSingleSignOnServiceProvider): string {
    return createSamlIdPMetadataXml(provider, this.config.url);
  }

  @bindThis
  public createSPMetadataXml(provider: MiSingleSignOnServiceProvider): string {
    return createSamlSPMetadataXml(provider);
  }

  @bindThis
  public async createServer(fastify: FastifyInstance): Promise<void> {
    await fastify.register(fastifyCors);
    await fastify.register(fastifyExpress);
    fastify.use('', bodyParser.urlencoded({ extended: false }));

    fastify.post<{ Body: SamlAuthorizeBody }>('/authorize', async (request, reply) => {
      const transactionId = request.body.transaction_id;
      const token = request.body.login_token;

      if (!transactionId) {
        reply.status(403);
        return createError('Invalid transaction id', 'INVALID_TRANSACTION_ID', 'cca6ea16-5f04-4d9e-9ef5-8a99bdef3a92', 'client');
      }

      const transactionString = await this.redisClient.get(`sso:saml:transaction:${transactionId}`);
      const transaction: unknown = transactionString ? JSON.parse(transactionString) : null;
      if (!isSamlTransaction(transaction)) {
        reply.status(403);
        return createError('Invalid transaction id', 'INVALID_TRANSACTION_ID', 'cca6ea16-5f04-4d9e-9ef5-8a99bdef3a92', 'client');
      }

      const provider = await this.getProvider(transaction.serviceId);
      if (!provider) {
        reply.status(403);
        return createError('Invalid SSO Service Provider id', 'INVALID_SSO_SP_ID', 'f644adfe-019a-478c-b5a9-897a2556f2b2', 'client');
      }

      if (!token) {
        reply.status(401);
        return createError('No login token', 'NO_LOGIN_TOKEN', 'cd96295e-0370-433d-a3de-421de4536b7f', 'client');
      }

      const user = await this.ssoRuntimeService.getUserByNativeToken(token);
      if (!user) {
        reply.status(403);
        return createError('Invalid login token', 'INVALID_LOGIN_TOKEN', 'a002a4ed-0024-460f-8015-cc5e7c6cd0a7', 'client');
      }

      if (!provider.privateKey) {
        reply.status(500);
        return createError('SAML private key is not configured', 'SAML_PRIVATE_KEY_NOT_CONFIGURED', 'd131157b-e6da-4c79-8730-9e624005ec87', 'server');
      }

      try {
        const profile = await this.userProfilesRepository.findOneByOrFail({ userId: user.id });
        const claims = await this.ssoRuntimeService.createUserProfileClaims(provider, user, profile);
        const idp = saml.IdentityProvider({
          metadata: this.createIdPMetadataXml(provider),
          privateKey: await getSamlPrivateKey(provider.privateKey, provider.signatureAlgorithm),
          loginResponseTemplate: { context: 'ignored' },
        });
        const sp = saml.ServiceProvider({ metadata: this.createSPMetadataXml(provider) });
        const requestInfo: RequestInfo = {
          samlContent: transaction.flowResult.samlContent,
          extract: transaction.flowResult.extract,
          sigAlg: transaction.flowResult.sigAlg,
        };
        const loginResponse = await idp.createLoginResponse(
          sp,
          requestInfo,
          provider.binding,
          {},
          {
            relayState: transaction.relayState,
            customTagReplacement: () => createSamlResponseXml(provider, this.config.url, transaction.flowResult, claims, user.id),
          },
        );

        this.#logger.info(`User "${user.username}" authorized for "${provider.name ?? provider.issuer}"`);
        reply.header('Cache-Control', 'no-store');

        if (provider.binding === 'post') {
          return {
            binding: 'post',
            action: provider.acsUrl,
            context: {
              SAMLResponse: loginResponse.context,
              RelayState: transaction.relayState,
            },
          };
        }

        return { binding: 'redirect', action: loginResponse.context };
      } catch (err) {
        this.#logger.error('Failed to create SAML response', { error: err });
        reply.status(500);
        return createError('Internal server error', 'INTERNAL_SERVER_ERROR', 'b83b7afd-adfc-4baf-8659-34623d639170', 'server');
      } finally {
        await this.redisClient.del(`sso:saml:transaction:${transactionId}`);
      }
    });

    fastify.get<{ Params: { serviceId: string } }>('/:serviceId/metadata', async (request, reply) => {
      const provider = await this.getProvider(request.params.serviceId);
      if (!provider) {
        reply.status(403);
        return createError('Invalid SSO Service Provider id', 'INVALID_SSO_SP_ID', '8a6d72e1-3530-4ec0-9d4d-b105fdbb8a2d', 'client');
      }

      reply.header('Content-Type', 'application/xml');
      return this.createIdPMetadataXml(provider);
    });

    fastify.all<{
      Params: { serviceId: string };
      Querystring: SamlRequestBody;
      Body: SamlRequestBody | undefined;
    }>('/:serviceId', async (request, reply) => {
      const { serviceId } = request.params;
      const binding = request.query.SAMLRequest ? 'redirect' : 'post';
      const samlRequest = request.query.SAMLRequest ?? request.body?.SAMLRequest;
      const relayState = request.query.RelayState ?? request.body?.RelayState;
      const prompt = request.query.prompt ?? request.body?.prompt ?? 'consent';
      const provider = await this.singleSignOnServiceProvidersRepository.findOneBy({
        id: serviceId,
        type: 'saml',
        privateKey: Not(IsNull()),
      });

      if (!provider) {
        reply.status(403);
        return createError('Invalid SSO Service Provider id', 'INVALID_SSO_SP_ID', 'e2893d7e-df6f-44cf-8717-42234b8ac0ce', 'client');
      }

      if (!provider.privateKey) {
        reply.status(500);
        return createError('SAML private key is not configured', 'SAML_PRIVATE_KEY_NOT_CONFIGURED', 'eb4ca4cb-0f49-4c9a-9c6e-2e1012c29731', 'server');
      }

      if (!samlRequest) {
        reply.status(400);
        return createError('No SAMLRequest', 'NO_SAML_REQUEST', 'c58bc7e3-f92e-4879-a6a9-7258a13bc491', 'client');
      }

      try {
        const idp = saml.IdentityProvider({
          metadata: this.createIdPMetadataXml(provider),
          privateKey: await getSamlPrivateKey(provider.privateKey, provider.signatureAlgorithm),
        });
        const sp = saml.ServiceProvider({ metadata: this.createSPMetadataXml(provider) });
        const flowResult = await idp.parseLoginRequest(sp, binding, { query: request.query, body: request.body });
        const transactionId = randomUUID();

        await this.redisClient.set(
          `sso:saml:transaction:${transactionId}`,
          JSON.stringify({ serviceId, flowResult, relayState } satisfies SamlTransaction),
          'EX',
          60 * 5,
        );

        this.#logger.info(`Rendering authorization page for "${provider.name ?? provider.issuer}"`);
        reply.header('Cache-Control', 'no-store');
        return await HtmlTemplateService.replyHtml(reply, SsoPage({
          ...await this.htmlTemplateService.getCommonData(),
          transactionId,
          serviceName: provider.name ?? provider.issuer,
          kind: 'saml',
          prompt,
        }));
      } catch (err) {
        this.#logger.error('Failed to parse SAML request', { error: err });
        reply.status(400);
        return createError('Invalid SAML Request', 'INVALID_SAML_REQUEST', '874b9cc2-71cb-4000-95c7-449391ee9861', 'client');
      }
    });
  }
}
