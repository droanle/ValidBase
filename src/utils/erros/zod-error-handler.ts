import { NextFunction, Request, Response } from 'express';
import { ValidationSchemeError } from 'gatex-express';
import defaultResponse from '../default-response';

export default function (
  err: ValidationSchemeError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  return defaultResponse(
    res,
    false,
    'Invalid Input',
    err.issues.map((issue) => ({
      field: issue.path.join('.'),
      problem: issue.message,
    })),
    422
  );
}
