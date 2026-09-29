import { Request, Response } from 'express';
import authService from '../../services/Auth.service';
import Session from '../../utils/Session';
import { getRequestMetadata } from '../../utils/request-metadata';
import defaultResponse from '../../utils/default-response';

export default {
  async register(req: Request, res: Response) {
    const { email, password } = req.body;

    await authService().register(email, password);

    return defaultResponse(
      res,
      true,
      'Account created successfully',
      null,
      201
    );
  },

  async login(req: Request, res: Response) {
    const { email, password } = req.body;

    const account = await authService().login(email, password);

    const metadata = getRequestMetadata(req);

    const session = (await Session.initSession(metadata)).loginAccount(account);

    return defaultResponse(
      res,
      true,
      'Account login successfully',
      {
        token: await session.getAccountToken(),
      },
      200
    );
  },
};
