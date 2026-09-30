import { redisC } from '../../database';
import { AppError } from '../../utils/erros/AppError';
import { NextFunction, Request, Response } from 'express';
import defaultResponse from '../../utils/default-response';

const PREFIX = 'rateLimiting';

export class RateLimitExceededError extends AppError {
  constructor(
    public readonly key: string,
    public readonly retryAfterSeconds: number
  ) {
    super(
      `Rate limit exceeded for key ${key}. Retry after ${retryAfterSeconds} seconds.`,
      429
    );
  }
}

/**
 * Checks and logs the rate limit for a given key.
 * @param key - The unique identifier for the rate limit (e.g., user ID, IP address).
 * @param limit - The maximum number of allowed requests within the tolerance time.
 * @param toleranceTime - The time window in minutes for which the rate limit applies.
 * @throws {RateLimitExceededError} If the rate limit is exceeded, with details about the retry time.
 */
async function checkAndLogRateLimit(
  key: string,
  limit: number,
  toleranceTime: number
): Promise<void> {
  const bucketKey = `${PREFIX}:${key}`;
  const toleranceSeconds = Math.max(1, Math.floor(toleranceTime * 60));

  const count = Number(await redisC.incr(bucketKey));
  if (!Number.isFinite(count))
    throw new Error(`Invalid rate limit counter value: ${String(count)}`);

  if (count === 1) await redisC.expire(bucketKey, toleranceSeconds);

  if (count <= limit) return;

  const ttl = Number(await redisC.ttl(bucketKey));
  const retryAfterSeconds = ttl > 0 ? ttl : toleranceSeconds;

  throw new RateLimitExceededError(key, retryAfterSeconds);
}

/**
 * Creates a rate limiting middleware.
 * @param tool - The name of the tool or service for which to apply rate limiting.
 * @param limit - The maximum number of allowed requests within the tolerance time.
 * @param toleranceTime - The time window in minutes for which the rate limit applies.
 */
export default function rateLimitMiddleware(
  tool: string,
  limit: number,
  toleranceTime: number
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await checkAndLogRateLimit(`${req.ip}:${tool}`, limit, toleranceTime);
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        res.setHeader('Retry-After', String(error.retryAfterSeconds));

        return defaultResponse(res, false, 'Too Many Requests', null, 429);
      }

      return next(error);
    }

    next();
  };
}
