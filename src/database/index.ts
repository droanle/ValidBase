import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './prisma-client/client';
import { ModelName } from './prisma-client/internal/prismaNamespace';
import { initRedisClient, type RedisClient, RedisFtIndexDefinition, } from './redis-client'; // ==========================================

// ==========================================
// DATABASE CONFIGURATION: PRISMA
// ==========================================

type ModelConfig = { field: string };
type ConfigModels = Partial<Record<ModelName, ModelConfig | boolean>>;
type QueryArgs = { where?: unknown } | undefined;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not defined');

const adapter: PrismaPg = new PrismaPg({ connectionString: databaseUrl });
const basePrisma = new PrismaClient({ adapter });

const softDeleteModels: ConfigModels = {
  Schema: true,
};

const defaultSoftDeleteField = 'deletedAt';

function getSoftDeleteField(model: ModelName): string | null {
  const config = softDeleteModels[model];
  if (!config) return null;

  return config === true ? defaultSoftDeleteField : config.field;
}

function hasOwnField(where: unknown, field: string): boolean {
  if (!where || typeof where !== 'object' || Array.isArray(where)) return false;

  return Object.prototype.hasOwnProperty.call(where, field);
}

function withSoftDeleteWhere<TArgs extends QueryArgs>(
  args: TArgs,
  field: string
): TArgs {
  const currentWhere =
    args && typeof args === 'object' ? (args as QueryArgs)?.where : undefined;

  if (hasOwnField(currentWhere, field)) return args;

  const where = currentWhere
    ? { AND: [currentWhere, { [field]: null }] }
    : { [field]: null };

  return {
    ...(args ?? {}),
    where,
  } as TArgs;
}

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
        async findMany({ model, args, query }) {
          const softDeleteField = getSoftDeleteField(model as ModelName);
          if (!softDeleteField) return query(args);

          return query(withSoftDeleteWhere(args, softDeleteField));
        },
        async findFirst({ model, args, query }) {
          const softDeleteField = getSoftDeleteField(model as ModelName);
          if (!softDeleteField) return query(args);

          return query(withSoftDeleteWhere(args, softDeleteField));
        },
        async findFirstOrThrow({ model, args, query }) {
          const softDeleteField = getSoftDeleteField(model as ModelName);
          if (!softDeleteField) return query(args);

          return query(withSoftDeleteWhere(args, softDeleteField));
        },
        async findUnique({ model, args, query }) {
          const softDeleteField = getSoftDeleteField(model as ModelName);
          if (!softDeleteField) return query(args);

          const prismaModel = model.charAt(0).toLowerCase() + model.slice(1);
          return (basePrisma as any)[prismaModel].findFirst(
            withSoftDeleteWhere(args, softDeleteField)
          );
        },
        async findUniqueOrThrow({ model, args, query }) {
          const softDeleteField = getSoftDeleteField(model as ModelName);
          if (!softDeleteField) return query(args);

          const prismaModel = model.charAt(0).toLowerCase() + model.slice(1);
          return (basePrisma as any)[prismaModel].findFirstOrThrow(
            withSoftDeleteWhere(args, softDeleteField)
          );
        },
        async count({ model, args, query }) {
          const softDeleteField = getSoftDeleteField(model as ModelName);
          if (!softDeleteField) return query(args);

          return query(withSoftDeleteWhere(args, softDeleteField));
        },
        async aggregate({ model, args, query }) {
          const softDeleteField = getSoftDeleteField(model as ModelName);
          if (!softDeleteField) return query(args);

          return query(withSoftDeleteWhere(args, softDeleteField));
        },
        async groupBy({ model, args, query }) {
          const softDeleteField = getSoftDeleteField(model as ModelName);
          if (!softDeleteField) return query(args);

          return query(withSoftDeleteWhere(args, softDeleteField));
        },
        async delete({ model, args, query }) {
          const softDeleteField = getSoftDeleteField(model as ModelName);
          if (!softDeleteField) return query(args);

          const prismaModel = model.charAt(0).toLowerCase() + model.slice(1);

          return (basePrisma as any)[prismaModel].update({
            ...args,
            data: {
              [softDeleteField]: new Date(),
            },
          });
        },
        async deleteMany({ model, args, query }) {
          const softDeleteField = getSoftDeleteField(model as ModelName);
          if (!softDeleteField) return query(args);

          const prismaModel = model.charAt(0).toLowerCase() + model.slice(1);

          return (basePrisma as any)[prismaModel].updateMany({
            ...args,
            data: {
              [softDeleteField]: new Date(),
            },
          });
        },
      },
    },
  });

// ==========================================
// DATABASE CONFIGURATION: REDIS
// ==========================================
const redisDatabaseUrl = process.env.REDIS_URL;
if (redisDatabaseUrl === undefined) throw new Error('REDIS_URL is not defined');

const redisIndexes: RedisFtIndexDefinition[] = [];

let redisClient: RedisClient;

async function initDatabases(): Promise<void> {
  redisClient = await initRedisClient(
    {
      url: redisDatabaseUrl as string,
      onConnect: async () => {
        console.log('>> Connected to Redis Database');
      },
      onError: async (err) => {
        console.error(`Redis connection error: ${err.message}`);
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

  let errors: { postgres?: string; redis?: string } | undefined;

  try {
    await redisClient.ping();
  } catch (error) {
    redisStatus = 'error';
    errors = {
      ...errors,
      redis: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }

  try {
    await prismaClient.$queryRaw`SELECT 1`;
  } catch (error) {
    postgresStatus = 'error';
    errors = {
      ...errors,
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
export type * from './prisma-client/enums';

export {
  prismaClient as prismaC,
  redisClient as redisC,
  initDatabases,
  testConnection,
};
