import { GroupingProvider } from 'gatex-express';
import { Request, Response } from 'express';
import { testConnection } from '../../database';
import { isProductionMode } from '../../utils/node-env-mode';
import rateLimitMiddleware from '../middlewares/RateLimiting.middleware';

type statusType = 'ok' | 'degraded' | 'error';

export default function (provider: GroupingProvider) {
  provider.get(
    '/health',
    rateLimitMiddleware('health', 10, 1),
    async (req: Request, res: Response) => {
      const databases = await testConnection();

      const status: statusType =
        databases.redis === 'ok' && databases.postgres === 'ok'
          ? 'ok'
          : 'degraded';

      let result: any = {
        status,
        timestamp: new Date().toISOString(),
      };

      if (isProductionMode()) delete databases.errors;

      result.databases = databases;

      res.status(status === 'ok' ? 200 : 503).json(result);
    }
  );
}
