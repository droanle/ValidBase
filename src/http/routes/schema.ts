import { GroupingProvider } from 'gatex-express';
import { z } from 'zod';
import SchemaController from '../controllers/Schema.controller';
import rateLimitMiddleware from '../middlewares/RateLimiting.middleware';

const createSchemaInput = z.object({
  name: z.string().min(1, 'Name is required.').max(100, 'Name too long.'),
  description: z.string().max(250, 'Description too long.').optional(),
  schema: z.any(),
});

const listSchemaInput = z.object({
  page: z.coerce.number().min(1, 'Page.').optional(),
  limit: z.coerce.number().max(100, 'Limit too long.').min(1, '').optional(),
});

const schemaIdParams = z.object({
  id: z.uuid('Invalid ID format.'),
});

// TODO: Definir parâmetros de rate limiting correta
export default function (provider: GroupingProvider) {
  provider.post(
    '/',
    createSchemaInput,
    rateLimitMiddleware('create-schema', 5, 1),
    SchemaController.create
  );

  provider.get(
    '/',
    listSchemaInput,
    rateLimitMiddleware('get-schema', 10, 1),
    SchemaController.list
  );

  provider.get(
    '/:id',
    { params: schemaIdParams },
    rateLimitMiddleware('get-schema-by-id', 10, 1),
    SchemaController.get
  );

  provider.delete(
    '/:id',
    { params: schemaIdParams },
    rateLimitMiddleware('delete-schema-by-id', 5, 1),
    SchemaController.delete
  );
}
