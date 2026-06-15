/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import bodyParser from 'body-parser';
import fastifyCors from '@fastify/cors';
import fastifyExpress from '@fastify/express';
import { type JWTPayload, EncryptJWT, SignJWT, base64url, importJWK, importPKCS8, importSPKI, importX509, jwtDecrypt, jwtVerify } from 'jose';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { SingleSignOnServiceProvidersRepository, UserProfilesRepository } from '@/models/_.js';
import type { MiSingleSignOnServiceProvider } from '@/models/SingleSignOnServiceProvider.js';
import { LoggerService } from '@/core/LoggerService.js';
import { HtmlTemplateService } from '@/server/web/HtmlTemplateService.js';
import { SsoPage } from '@/server/web/views/sso.js';
import Logger from '@/logger.js';
import { SsoRuntimeService, type SsoUserProfileClaims } from './SsoRuntimeService.js';
import type { FastifyInstance } from 'fastify';
import type { CryptoKey, JWK, KeyObject } from 'jose';

type JoseKey = CryptoKey | KeyObject | Uint8Array;

interface JwtTransaction {
  serviceId: string;
  returnTo?: string;
}

interface SsoRequestBody {
  serviceurl?: string;
  return_to?: string;
  prompt?: string;
}

interface JwtAuthorizeBody {
  transaction_id?: string;
  login_token?: string;
}

interface JwtVerifyBody {
  jwt?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJwtTransaction(value: unknown): value is JwtTransaction {
  return isRecord(value) && typeof value.serviceId === 'string' && (value.returnTo === undefined || typeof value.returnTo === 'string');
}

function isJwk(value: unknown): value is JWK {
  return isRecord(value) && typeof value.kty === 'string';
}

function parseJsonKeyMaterial(material: string): JWK | null {
  if (!material.trim().startsWith('{')) return null;
  const parsed: unknown = JSON.parse(material);
  if (!isJwk(parsed)) throw new Error('Invalid JWK key material');
  return parsed;
}

async function importPublicKey(material: string, algorithm: string): Promise<JoseKey> {
  const jwk = parseJsonKeyMaterial(material);
  if (jwk) return await importJWK(jwk, algorithm);

  const trimmed = material.trim();
  if (trimmed.includes('BEGIN CERTIFICATE')) return await importX509(trimmed, algorithm);
  if (trimmed.includes('BEGIN PUBLIC KEY')) return await importSPKI(trimmed, algorithm);
  return base64url.decode(trimmed);
}

async function importPrivateKey(material: string, algorithm: string): Promise<JoseKey> {
  const jwk = parseJsonKeyMaterial(material);
  if (jwk) return await importJWK(jwk, algorithm);

  const trimmed = material.trim();
  if (trimmed.includes('BEGIN PRIVATE KEY')) return await importPKCS8(trimmed, algorithm);
  return base64url.decode(trimmed);
}

function createJwtPayload(claims: SsoUserProfileClaims): JWTPayload {
  return {
    name: claims.name,
    given_name: claims.given_name,
    family_name: claims.family_name,
    preferred_username: claims.preferred_username,
    profile: claims.profile,
    picture: claims.picture,
    email: claims.email,
    email_verified: claims.email_verified,
    mfa_enabled: claims.mfa_enabled,
    updated_at: claims.updated_at,
    admin: claims.admin,
    moderator: claims.moderator,
    roles: claims.roles,
  };
}

export async function createJwtIdentityToken(provider: MiSingleSignOnServiceProvider, userId: string, claims: SsoUserProfileClaims): Promise<string> {
  if (provider.cipherAlgorithm) {
    const key = await importPublicKey(provider.publicKey, provider.signatureAlgorithm);
    return await new EncryptJWT(createJwtPayload(claims))
      .setProtectedHeader({ typ: 'JWT', alg: provider.signatureAlgorithm, enc: provider.cipherAlgorithm })
      .setIssuer(provider.issuer)
      .setAudience(provider.audience)
      .setIssuedAt()
      .setExpirationTime('2w')
      .setJti(randomUUID())
      .setSubject(userId)
      .encrypt(key);
  }

  const keyMaterial = provider.privateKey ?? provider.publicKey;
  const key = await importPrivateKey(keyMaterial, provider.signatureAlgorithm);
  return await new SignJWT(createJwtPayload(claims))
    .setProtectedHeader({ typ: 'JWT', alg: provider.signatureAlgorithm })
    .setIssuer(provider.issuer)
    .setAudience(provider.audience)
    .setIssuedAt()
    .setExpirationTime('2w')
    .setJti(randomUUID())
    .setSubject(userId)
    .sign(key);
}

export async function verifyJwtIdentityToken(provider: MiSingleSignOnServiceProvider, token: string): Promise<JWTPayload> {
  if (provider.cipherAlgorithm) {
    const keyMaterial = provider.privateKey ?? provider.publicKey;
    const key = await importPrivateKey(keyMaterial, provider.signatureAlgorithm);
    const { payload } = await jwtDecrypt(token, key, {
      issuer: provider.issuer,
      audience: provider.audience,
    });
    return payload;
  }

  const key = await importPublicKey(provider.publicKey, provider.signatureAlgorithm);
  const { payload } = await jwtVerify(token, key, {
    issuer: provider.issuer,
    audience: provider.audience,
  });
  return payload;
}

function createError(message: string, code: string, id: string, kind: 'client' | 'server') {
  return { error: { message, code, id, kind } };
}

@Injectable()
export class JWTIdentifyProviderService {
  #logger: Logger;

  constructor(
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
    this.#logger = this.loggerService.getLogger('sso:jwt');
  }

  @bindThis
  private async getProvider(serviceId: string): Promise<MiSingleSignOnServiceProvider | null> {
    return await this.singleSignOnServiceProvidersRepository.findOneBy({ id: serviceId, type: 'jwt' });
  }

  @bindThis
  public async createServer(fastify: FastifyInstance): Promise<void> {
    await fastify.register(fastifyCors);
    await fastify.register(fastifyExpress);
    fastify.use('', bodyParser.urlencoded({ extended: false }));

    fastify.post<{ Body: JwtAuthorizeBody }>('/authorize', async (request, reply) => {
      const transactionId = request.body.transaction_id;
      const token = request.body.login_token;

      if (!transactionId) {
        reply.status(403);
        return createError('Invalid transaction id', 'INVALID_TRANSACTION_ID', '91fa6511-0b33-47d6-bd01-b420d80fcd6a', 'client');
      }

      const transactionString = await this.redisClient.get(`sso:jwt:transaction:${transactionId}`);
      const transaction: unknown = transactionString ? JSON.parse(transactionString) : null;
      if (!isJwtTransaction(transaction)) {
        reply.status(403);
        return createError('Invalid transaction id', 'INVALID_TRANSACTION_ID', '91fa6511-0b33-47d6-bd01-b420d80fcd6a', 'client');
      }

      const provider = await this.getProvider(transaction.serviceId);
      if (!provider) {
        reply.status(403);
        return createError('Invalid SSO Service Provider id', 'INVALID_SSO_SP_ID', 'c038610c-4c11-40ce-9371-131d5720f511', 'client');
      }

      if (!token) {
        reply.status(401);
        return createError('No login token', 'NO_LOGIN_TOKEN', '399e756c-35cd-459c-a7ba-8cc12eb39eef', 'client');
      }

      const user = await this.ssoRuntimeService.getUserByNativeToken(token);
      if (!user) {
        reply.status(403);
        return createError('Invalid login token', 'INVALID_LOGIN_TOKEN', '3b92ee31-9215-447a-805f-df8f15ffb8b2', 'client');
      }

      try {
        const profile = await this.userProfilesRepository.findOneByOrFail({ userId: user.id });
        const claims = await this.ssoRuntimeService.createUserProfileClaims(provider, user, profile);
        const jwt = await createJwtIdentityToken(provider, user.id, claims);

        this.#logger.info(`User "${user.username}" authorized for "${provider.name ?? provider.issuer}"`);
        reply.header('Cache-Control', 'no-store');

        if (provider.binding === 'post') {
          return {
            binding: 'post',
            action: provider.acsUrl,
            context: {
              jwt,
              return_to: transaction.returnTo,
            },
          };
        }

        const action = new URL(provider.acsUrl);
        action.searchParams.set('jwt', jwt);
        if (transaction.returnTo) action.searchParams.set('return_to', transaction.returnTo);
        return { binding: 'redirect', action: action.toString() };
      } catch (err) {
        this.#logger.error('Failed to create JWT', { error: err });
        reply.status(500);
        return createError('Internal server error', 'INTERNAL_SERVER_ERROR', 'fe1c597c-a515-46a1-860b-bd316b11aff9', 'server');
      } finally {
        await this.redisClient.del(`sso:jwt:transaction:${transactionId}`);
      }
    });

    fastify.all<{
      Params: { serviceId: string };
      Querystring: SsoRequestBody;
      Body: SsoRequestBody | undefined;
    }>('/:serviceId', async (request, reply) => {
      const { serviceId } = request.params;
      const returnTo = request.query.return_to ?? request.query.serviceurl ?? request.body?.return_to ?? request.body?.serviceurl;
      const prompt = request.query.prompt ?? request.body?.prompt ?? 'consent';
      const provider = await this.getProvider(serviceId);

      if (!provider) {
        reply.status(403);
        return createError('Invalid SSO Service Provider id', 'INVALID_SSO_SP_ID', 'c6aafae6-e8b9-420c-a87a-6ac08402165b', 'client');
      }

      const transactionId = randomUUID();
      await this.redisClient.set(
        `sso:jwt:transaction:${transactionId}`,
        JSON.stringify({ serviceId, returnTo } satisfies JwtTransaction),
        'EX',
        60 * 5,
      );

      this.#logger.info(`Rendering authorization page for "${provider.name ?? provider.issuer}"`);
      reply.header('Cache-Control', 'no-store');
      return await HtmlTemplateService.replyHtml(reply, SsoPage({
        ...await this.htmlTemplateService.getCommonData(),
        transactionId,
        serviceName: provider.name ?? provider.issuer,
        kind: 'jwt',
        prompt,
      }));
    });
  }

  @bindThis
  public async createApiServer(fastify: FastifyInstance): Promise<void> {
    await fastify.register(fastifyCors);

    fastify.post<{
      Params: { serviceId: string };
      Body: JwtVerifyBody | undefined;
    }>('/verify/:serviceId', async (request, reply) => {
      const provider = await this.getProvider(request.params.serviceId);
      if (!provider) {
        reply.status(403);
        return createError('Invalid SSO Service Provider id', 'INVALID_SSO_SP_ID', '077e0930-88c1-4f25-bd4e-4da8e34f735b', 'client');
      }

      const jwt = request.body?.jwt;
      if (!jwt) {
        reply.status(400);
        return createError('Invalid JWT', 'INVALID_JWT', '39075dbb-03eb-485f-8ee1-f16b625bcc4d', 'client');
      }

      try {
        const payload = await verifyJwtIdentityToken(provider, jwt);
        return { payload };
      } catch (err) {
        this.#logger.error('Failed to verify JWT', { error: err });
        reply.status(400);
        return createError('Invalid JWT', 'INVALID_JWT', '39075dbb-03eb-485f-8ee1-f16b625bcc4d', 'client');
      }
    });
  }
}
