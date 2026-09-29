import { AccountModel, prismaC } from '../database';

export default class AccountRepository {
  static async create(
    email: string,
    passwordHash: string
  ): Promise<AccountModel> {
    return prismaC.account.create({
      data: { email, passwordHash },
    });
  }

  static async findByEmail(email: string): Promise<AccountModel | null> {
    return prismaC.account.findUnique({ where: { email } });
  }
}
