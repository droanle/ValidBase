import bcrypt from 'bcryptjs';
import AccountRepository from '../repositories/Account.repository';
import { AccountModel } from '../database';
import { AppError } from '../utils/erros/AppError';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { DUMMY_HASH } from '../utils/dummy';

export default () => ({
  async register(email: string, password: string) {
    if (await AccountRepository.findByEmail(email))
      throw new AppError('Email already exists', 409);

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      return await AccountRepository.create(email, passwordHash);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError)
        if (error.code === 'P2002')
          throw new AppError('Email already exists', 409);

      throw new AppError('Failed to create account', 500);
    }
  },
  async login(email: string, password: string): Promise<AccountModel> {
    const account = await AccountRepository.findByEmail(email);

    const isPasswordValid = await bcrypt.compare(
      password,
      account?.passwordHash ?? DUMMY_HASH
    );

    if (!account || !isPasswordValid)
      throw new AppError('Invalid Credentials', 401);

    return account;
  },
});
