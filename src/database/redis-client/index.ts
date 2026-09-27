import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

type RedisConnectionParams = {
  url: string;
  onConnect?: () => void;
  onError?: (error: Error) => void;
};

export type RedisFtIndexDefinition = {
  name: string;
  schema: Parameters<RedisClient['ft']['create']>[1];
  options: Parameters<RedisClient['ft']['create']>[2];
};

const globalRedis = globalThis as typeof globalThis & {
  __redisClient?: unknown;
  __redisConnectionPromise?: Promise<unknown>;
  __redisClientUrl?: string;
  __redisIndexPromise?: Promise<void>;
};

function buildRedisClient({
  url,
  onConnect,
  onError,
}: RedisConnectionParams): RedisClient {
  const client = createClient({ url });

  if (onConnect) client.on('connect', onConnect);
  if (onError) client.on('error', onError);

  return client as RedisClient;
}

async function getRedisClient(
  params: RedisConnectionParams
): Promise<RedisClient> {
  const cachedClient = globalRedis.__redisClient as RedisClient | undefined;
  const isSameUrl = globalRedis.__redisClientUrl === params.url;

  if (cachedClient?.isOpen && isSameUrl) return cachedClient;

  if (globalRedis.__redisConnectionPromise && isSameUrl)
    return globalRedis.__redisConnectionPromise as Promise<RedisClient>;

  const client = buildRedisClient(params);
  globalRedis.__redisClient = client;
  globalRedis.__redisClientUrl = params.url;

  globalRedis.__redisConnectionPromise = client
    .connect()
    .then(() => client)
    .catch((error) => {
      globalRedis.__redisConnectionPromise = undefined;
      globalRedis.__redisClient = undefined;
      globalRedis.__redisClientUrl = undefined;
      throw error;
    });

  return globalRedis.__redisConnectionPromise as Promise<RedisClient>;
}

async function ensureRedisIndex(
  client: RedisClient,
  indexDefinition: RedisFtIndexDefinition
): Promise<void> {
  try {
    await client.ft.info(indexDefinition.name);
    return;
  } catch (error) {
    if (!(error instanceof Error)) throw error;

    if (
      error.message.includes('unknown command') &&
      error.message.includes('FT.')
    ) {
      console.warn(
        `RedisSearch module is not available; continuing without FT index "${indexDefinition.name}".`
      );
      return;
    }

    if (!error.message.includes('Unknown Index name')) throw error;
  }

  try {
    await client.ft.create(
      indexDefinition.name,
      indexDefinition.schema,
      indexDefinition.options
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Index already exists')
    )
      return;
    throw error;
  }
}

async function ensureRedisIndexes(
  client: RedisClient,
  redisIndexes: RedisFtIndexDefinition[]
): Promise<void> {
  if (!globalRedis.__redisIndexPromise) {
    globalRedis.__redisIndexPromise = Promise.all(
      redisIndexes.map((indexDefinition) =>
        ensureRedisIndex(client, indexDefinition)
      )
    )
      .then(() => undefined)
      .catch((error) => {
        globalRedis.__redisIndexPromise = undefined;
        throw error;
      });
  }

  await globalRedis.__redisIndexPromise;
}

async function initRedisClient(
  params: RedisConnectionParams,
  redisIndexes: RedisFtIndexDefinition[]
): Promise<RedisClient> {
  const client = await getRedisClient({
    url: params.url,
    onConnect: params.onConnect,
    onError: params.onError,
  });

  await ensureRedisIndexes(client, redisIndexes);
  return client;
}

export { initRedisClient };
export { type RedisClient };
export { type RedisJSON } from 'redis';
