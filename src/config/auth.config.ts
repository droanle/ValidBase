import { isProductionMode } from '../utils/node-env-mode';

const requiredInProduction = [
  'AUTH_SECRET',
  'AUTH_ISSUER',
  'AUTH_TOKEN_TTL',
] as const;

export interface AuthConfig {
  algorithm: string;
  issuer: string;
  tokenTtlSeconds: number;
  signingKey(): Uint8Array;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getAuthConfig(): AuthConfig {
  if (isProductionMode()) {
    const missing = requiredInProduction.filter((name) => !process.env[name]);

    if (missing.length > 0)
      throw new Error(
        `Missing required authentication configuration: ${missing.join(', ')}`
      );
  }

  const jwtSecret = process.env.AUTH_SECRET || 'JWT_Secret_From_Test';
  if (!jwtSecret || jwtSecret.length < 32)
    throw new Error('AUTH_SECRET must contain at least 32 characters.');

  return {
    algorithm: 'HS256',
    issuer: process.env.AUTH_ISSUER ?? 'valid_base',
    tokenTtlSeconds: positiveInteger(
      process.env.AUTH_TOKEN_TTL,
      60 * 60 * 24 * 14
    ),
    signingKey: (): Uint8Array => new TextEncoder().encode(jwtSecret),
  };
}

const authConfig = getAuthConfig();
export default authConfig;
