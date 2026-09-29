import { NextFunction, Request, Response } from 'express';
import Session, { SessionMode } from '../../utils/Session';
import { getRequestMetadata } from '../../utils/request-metadata';

export default async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  let sessionMode: SessionMode = null;
  const auth = req.headers.authorization;

  let credential: { token: string; password?: string | null } | undefined;

  if (auth?.startsWith('Basic ')) {
    sessionMode = 'access';

    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const sep = decoded.indexOf(':');
    const token = sep === -1 ? decoded : decoded.slice(0, sep);
    const password = sep === -1 ? undefined : decoded.slice(sep + 1);

    credential = { token, password };
  } else if (auth?.startsWith('Bearer ')) {
    sessionMode = 'account';
    credential = { token: auth?.split(' ')[1] };
  }

  req.session = await Session.initSession(
    getRequestMetadata(req),
    sessionMode,
    credential
  );

  next();
}
