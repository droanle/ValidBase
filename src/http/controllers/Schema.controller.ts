import { Request, Response } from 'express';
import { AnySchema } from 'ajv';
import validateAjvSchema from '../../utils/validate-ajv-schema';
import SchemaService from '../../services/Schema.service';
import Session from '../../utils/Session';
import { AppError } from '../../utils/erros/AppError';
import defaultResponse from '../../utils/default-response';

export default {
  async get(req: Request, res: Response) {
    const { id }: { id: string } = req.params as any;

    const schema = await SchemaService(req.session as Session).getById(id);

    if (!schema) throw new AppError('Schema not found.', 404);

    return defaultResponse(res, true, 'Schema retrieved successfully', {
      id: schema.id,
      name: schema.name,
      description: schema.description,
      schema: schema.jsonSchema,
    });
  },
  async list(req: Request, res: Response) {
    const { page = 1, limit = 10 } = req.query;

    const result = await SchemaService(req.session as Session).list(
      parseInt(page as string),
      parseInt(limit as string)
    );

    return defaultResponse(res, true, 'Schemas retrieved successfully', {
      page,
      limit,
      list: result.schemas.map((schema) => ({
        id: schema.id,
        name: schema.name,
        description: schema.description,
      })),
      total: result.total,
    });
  },
  async create(req: Request, res: Response) {
    const { name, description, schema } = req.body;

    validateAjvSchema(schema as AnySchema);

    const newSchema = await SchemaService(req.session as Session).create(
      name,
      description,
      schema
    );

    if (!newSchema) throw new AppError('Failed to create schema.', 400);

    return defaultResponse(
      res,
      true,
      'Schema created successfully',
      {
        id: newSchema.id,
        name: newSchema.name,
        description: newSchema.description,
      },
      201
    );
  },
  async delete(req: Request, res: Response) {
    const { id }: { id: string } = req.params as any;

    const deleted = await SchemaService(req.session as Session).delete(id);

    if (!deleted) throw new AppError('Schema not found.', 400);

    return defaultResponse(res, true, 'Schema deleted successfully');
  },
};
