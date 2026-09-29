import { NextFunction, Request, Response } from 'express';
import defaultResponse from '../default-response';
import { isProductionMode } from '../node-env-mode';
import { AppError } from './AppError';
import { InvalidTokenError } from '../Session';

export default function (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  let response: {
    success: boolean;
    message: string;
    content: any;
    status?: number;
  } = {
    success: false,
    message: err.message,
    content: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    status: 500,
  };

  if (err instanceof AppError) {
    response.status = err.status;
  }

  if (err instanceof InvalidTokenError) {
    response.status = 401;
  }

  if (isProductionMode()) response.content = null;

  return defaultResponse(
    res,
    response.success,
    response.message,
    response.content,
    response.status
  );
}
