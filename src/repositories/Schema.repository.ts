import { prismaC, SchemaModel } from '../database';

export default class SchemaRepository {
  static async getByIdAndOwner(
    ownerId: string,
    id: string
  ): Promise<SchemaModel | null> {
    return prismaC.schema.findFirst({
      where: { id, ownerId },
    });
  }

  static async list(
    ownerId: string,
    page: number,
    limit: number
  ): Promise<{ schemas: SchemaModel[]; total: number }> {
    const list = prismaC.schema.findMany({
      where: { ownerId },
      skip: (page - 1) * limit,
      take: limit,
    });

    const count = prismaC.schema.count({
      where: { ownerId },
    });

    const [schemas, total] = await Promise.all([list, count]);

    return {
      schemas,
      total,
    };
  }

  static async create(
    ownerId: string,
    name: string,
    description: string,
    jsonSchema: any
  ): Promise<SchemaModel | null> {
    return prismaC.schema.create({
      data: { name, description, jsonSchema, ownerId },
    });
  }

  static async delete(id: string): Promise<SchemaModel | null> {
    return prismaC.schema.delete({ where: { id } });
  }
}
