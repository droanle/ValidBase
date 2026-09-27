import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { SCHEMA_FIELD_TYPE } from 'redis';
import { PrismaClient } from './prisma-client/client'; // Importe apenas o Client
import { ModelName } from './prisma-client/internal/prismaNamespace';
import { initRedisClient, type RedisClient, RedisFtIndexDefinition, } from './redis-client';

// ==========================================
// DATABASE CONFIGURATION: PRISMA
// ==========================================
type ModelConfig = {
  field: string;
};

type ConfigModels = Partial<Record<ModelName, ModelConfig | boolean>>;

let adapter: PrismaBetterSqlite3 | PrismaPg;
const databaseUrl =
  process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || '';

if (!databaseUrl)
  throw new Error('DATABASE_URL or TEST_DATABASE_URL is not defined');

if (databaseUrl && databaseUrl.startsWith('file:')) {
  // Use SQLite adapter when DATABASE_URL points to a file
  adapter = new PrismaBetterSqlite3({
    url: databaseUrl,
  });
} else {
  // Default to Postgres adapter and use DATABASE_URL
  adapter = new PrismaPg({
    connectionString: databaseUrl || process.env.DATABASE_URL || '',
  });
}

const basePrisma = new PrismaClient({ adapter });

const softDeleteModels: ConfigModels = {};

const prismaClient = basePrisma

  // ==========================================
  // ===== 1ª EXTENSÃO: Virtual Fields (Result)
  // ==========================================
  .$extends({
    name: 'virtual-fields',
    result: {},
  })

  // ==========================================
  // ===== 2ª EXTENSÃO: Soft Delete (Query)
  // ==========================================
  .$extends({
    name: 'soft-delete',
    result: {},
    query: {
      $allModels: {
        async delete({ model, args, query }) {
          if (!Object.keys(softDeleteModels).includes(model))
            return query(args);

          const prismaModel = model.charAt(0).toLowerCase() + model.slice(1);

          return (basePrisma as any)[prismaModel].update({
            ...args,
            data: {
              deletedAt: new Date(),
            },
          });
        },
        async deleteMany({ model, args, query }) {
          if (!Object.keys(softDeleteModels).includes(model))
            return query(args);

          const prismaModel = model.charAt(0).toLowerCase() + model.slice(1);

          return (basePrisma as any)[prismaModel].updateMany({
            ...args,
            data: {
              deletedAt: new Date(),
            },
          });
        },
      },
    },
  });

// ==========================================
// DATABASE CONFIGURATION: REDIS
// ==========================================
const redisDatabaseUrl =
  process.env.REDIS_URL || process.env.TEST_REDIS_URL || '';

if (!redisDatabaseUrl)
  throw new Error('REDIS_URL or TEST_REDIS_URL is not defined');

const redisIndexes: RedisFtIndexDefinition[] = [
  {
    name: 'idx:session',
    schema: {
      '$.userId': {
        type: SCHEMA_FIELD_TYPE.TEXT,
        AS: 'sessionUserId',
      },
      '$.*.userId': {
        type: SCHEMA_FIELD_TYPE.TEXT,
        AS: 'userId',
      },
      '$.*.workspaceId': {
        type: SCHEMA_FIELD_TYPE.TEXT,
        AS: 'workspaceId',
      },
      '$.*.client.ip': {
        type: SCHEMA_FIELD_TYPE.TEXT,
        AS: 'clientIp',
      },
      '$.*.client.userAgent': {
        type: SCHEMA_FIELD_TYPE.TEXT,
        AS: 'clientUserAgent',
      },
      '$.*.client.id': {
        type: SCHEMA_FIELD_TYPE.TEXT,
        AS: 'clientId',
      },
      '$.*.client.name': {
        type: SCHEMA_FIELD_TYPE.TEXT,
        AS: 'clientName',
      },
    },
    options: {
      ON: 'JSON',
      PREFIX: 'session:',
    },
  },
];

let redisClient: RedisClient;

async function initDatabases(): Promise<void> {
  redisClient = await initRedisClient(
    {
      url: redisDatabaseUrl,
      onConnect: async () => {
        console.log('>> Connected to Redis Database');
      },
      onError: async (err) => {
        throw new Error(`Redis connection error: ${err.message}`);
      },
    },
    redisIndexes
  );
}

async function testConnection(): Promise<{
  redis: 'ok' | 'error';
  postgres: 'ok' | 'error';
  errors?: { postgres?: string };
}> {
  let redisStatus: 'ok' | 'error' = 'ok';
  let postgresStatus: 'ok' | 'error' = 'ok';

  let errors: { postgres?: string } | undefined;

  if (!redisClient) redisStatus = 'error';

  try {
    await prismaClient.$queryRaw`SELECT 1`;
  } catch (error) {
    postgresStatus = 'error';
    errors = {
      postgres:
        error instanceof Error ? error.message : 'Unknown database error',
    };
  }

  return {
    redis: redisStatus,
    postgres: postgresStatus,
    ...(errors ? { errors } : {}),
  };
}

export * from './redis-client';
export type * from './prisma-client/models';

export {
  prismaClient as prismaC,
  redisClient as redisC,
  initDatabases,
  testConnection,
};
