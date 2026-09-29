import { Metadata } from './request-metadata';
import { AccountModel, PermissionLevel, TargetType } from '../database';

import { jwtVerify, SignJWT } from 'jose';
import authConfig from '../config/auth.config';
import AccessTokenService from '../services/AccessToken.service';

export class InvalidTokenError extends Error {
  constructor() {
    super('Invalid or expired token');
    this.name = 'InvalidTokenError';
  }
}

export type SessionMode = 'account' | 'access' | null;

type AccountSession = {
  id: string;
  email: string;
};

type AccessSession = {
  id: string;
  targetId: string;
  targetType: TargetType;
  permissionLevel: PermissionLevel;
};

export default class Session {
  #metadata: Metadata;
  #accountSession?: AccountSession;
  #accessSession?: AccessSession;

  private constructor(
    metadata: Metadata,
    accountSession?: AccountSession,
    accessSession?: AccessSession
  ) {
    this.#metadata = metadata;
    this.#accountSession = accountSession;
    this.#accessSession = accessSession;
  }

  public get metadata(): Metadata {
    return this.#metadata;
  }

  public get accountSession(): AccountSession | undefined {
    return this.#accountSession;
  }

  public get accessSession(): AccessSession | undefined {
    return this.#accessSession;
  }

  public get mode(): SessionMode {
    if (this.#accountSession) return 'account';
    if (this.#accessSession) return 'access';
    return null;
  }

  public static async initSession(
    metadata: Metadata,
    mode: SessionMode = null,
    credential?: { token: string; password?: string | null }
  ): Promise<Session> {
    if (mode == 'account' && credential?.token)
      return this.initAccountSession(credential.token, metadata);
    else if (mode == 'access' && credential?.token)
      return this.initAccessSession(
        credential.token,
        credential.password ?? null,
        metadata
      );

    return new Session(metadata);
  }

  protected static async initAccountSession(
    token: string,
    metadata: Metadata
  ): Promise<Session> {
    try {
      const { payload } = await jwtVerify(token, authConfig.signingKey(), {
        algorithms: [authConfig.algorithm],
        issuer: authConfig.issuer,
      });

      return new Session(metadata, {
        id: payload.sub as string,
        email: payload.email as string,
      });
    } catch (err) {
      throw new InvalidTokenError();
    }
  }

  protected static async initAccessSession(
    token: string,
    password: string | null,
    metadata: Metadata
  ): Promise<Session> {
    const access = await AccessTokenService().checkToken(
      token,
      password ?? undefined
    );

    return new Session(metadata, undefined, {
      id: access.id,
      targetId: access.targetId,
      targetType: access.targetType,
      permissionLevel: access.permissionLevel,
    });
  }

  public loginAccount(account: AccountModel): this {
    this.#accountSession = {
      id: account.id,
      email: account.email,
    };

    return this;
  }

  public async getAccountToken(): Promise<string> {
    const accountSession = this.#accountSession;
    if (!accountSession) throw new Error('No account session available');

    return new SignJWT({
      email: accountSession.email,
    })
      .setProtectedHeader({ alg: authConfig.algorithm, typ: 'JWT' })
      .setSubject(accountSession.id)
      .setIssuer(authConfig.issuer)
      .setIssuedAt()
      .setExpirationTime(`${authConfig.tokenTtlSeconds}s`)
      .sign(authConfig.signingKey());
  }

  // public async createAccessToken(){}
}
