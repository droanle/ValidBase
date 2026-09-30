import { NextFunction, Request, Response } from 'express';
import defaultResponse from '../default-response';
import { isProductionMode } from '../node-env-mode';
import { AppError } from './AppError';
import { InvalidCredentialError } from '../Session';
import { AjvValidationError } from './AjvValidationError';

export default function (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  let response: {
    success: boolean;
    message: string;
    content?: any;
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

  // === Handling Process Errors ===
  if (err instanceof AppError) response.status = err.status;

  if (err instanceof InvalidCredentialError) {
    response.status = 401;
    response.content = { ...response.content, reason: err.reason };
  }

  if (isProductionMode()) response.content = undefined;
  // === Handling Process Errors ===

  // === Handling Errors with descriptive content ===
  if (err instanceof AjvValidationError) {
    response.status = 422;
    response.content = err.details;
  }
  // === Handling Errors with descriptive content ===

  return defaultResponse(
    res,
    response.success,
    response.message,
    response.content,
    response.status
  );
}
