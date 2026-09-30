import Session, { InvalidCredentialError } from '../utils/Session';
import AccessTokenRepository from '../repositories/AccessToken.repository';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/erros/AppError';
import { AccessTokenModel } from '../database';
import { DUMMY_HASH } from '../utils/dummy';
import { sha256 } from '../utils/hash';

export default (session?: Session) => ({
  async checkToken(
    token: string,
    password?: string
  ): Promise<AccessTokenModel> {
    const accessToken = await AccessTokenRepository.findByTokenHash(
      sha256(token)
    );

    if (!accessToken) throw new InvalidCredentialError('Invalid token');
    if (accessToken.expiresAt && accessToken.expiresAt < new Date())
      throw new InvalidCredentialError('Token expired');

    const passwordOk = await bcrypt.compare(
      password ?? 'DUMMY-SECRET',
      accessToken.passwordHash ?? DUMMY_HASH
    );
    if (accessToken.passwordHash && !passwordOk)
      throw new AppError('Not found', 404);

    return accessToken;
  },
});
