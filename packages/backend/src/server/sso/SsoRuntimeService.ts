/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { MiLocalUser } from '@/models/User.js';
import type { MiSingleSignOnServiceProvider } from '@/models/SingleSignOnServiceProvider.js';
import type { MiUserProfile, UsersRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { CacheService } from '@/core/CacheService.js';
import { IdService } from '@/core/IdService.js';
import { RoleService } from '@/core/RoleService.js';

export interface SsoUserProfileClaims {
  name: string;
  given_name: string | undefined;
  family_name: string;
  preferred_username: string;
  profile: string;
  picture: string | undefined;
  email: string;
  email_verified: boolean;
  mfa_enabled: boolean;
  updated_at: number;
  admin: boolean;
  moderator: boolean;
  roles: string[];
}

export function normalizeSsoEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function getSsoEmailAddress(
  user: MiLocalUser,
  profile: MiUserProfile,
  provider: MiSingleSignOnServiceProvider,
  hostname: string,
): { email: string; verified: boolean } {
  if (profile.emailVerified && profile.email != null) {
    return {
      email: provider.wantEmailAddressNormalized ? normalizeSsoEmailAddress(profile.email) : profile.email,
      verified: true,
    };
  }

  return {
    email: `${user.username}@users.${hostname}`,
    verified: false,
  };
}

@Injectable()
export class SsoRuntimeService {
  constructor(
    @Inject(DI.config)
    private config: Config,

    @Inject(DI.usersRepository)
    private usersRepository: UsersRepository,

    private cacheService: CacheService,
    private idService: IdService,
    private roleService: RoleService,
  ) {
  }

  @bindThis
  public async getUserByNativeToken(token: string): Promise<MiLocalUser | null> {
    return await this.cacheService.localUserByNativeTokenCache.fetch(
      token,
      () => this.usersRepository.findOneBy({ token }) as Promise<MiLocalUser | null>,
    );
  }

  @bindThis
  public async createUserProfileClaims(
    provider: MiSingleSignOnServiceProvider,
    user: MiLocalUser,
    profile: MiUserProfile,
  ): Promise<SsoUserProfileClaims> {
    const isAdministrator = await this.roleService.isAdministrator(user);
    const isModerator = await this.roleService.isModerator(user);
    const roles = await this.roleService.getUserRoles(user.id);
    const email = getSsoEmailAddress(user, profile, provider, this.config.hostname);
    const updatedAt = user.updatedAt ?? this.idService.parse(user.id).date;

    return {
      name: user.name ? `${user.name} (@${user.username})` : `@${user.username}`,
      given_name: user.name ?? undefined,
      family_name: `@${user.username}`,
      preferred_username: user.username,
      profile: `${this.config.url}/@${user.username}`,
      picture: user.avatarUrl ?? undefined,
      email: email.email,
      email_verified: email.verified,
      mfa_enabled: profile.twoFactorEnabled,
      updated_at: Math.floor(updatedAt.getTime() / 1000),
      admin: isAdministrator,
      moderator: isModerator,
      roles: roles.filter(role => role.isPublic).map(role => role.id),
    };
  }
}
