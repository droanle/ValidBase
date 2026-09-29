import { AccessTokenModel, prismaC } from '../database';

export default class AccessTokenRepository {
  static async findByTokenHash(
    tokenHash: string
  ): Promise<AccessTokenModel | null> {
    return prismaC.accessToken.findUnique({ where: { tokenHash } });
  }
}
