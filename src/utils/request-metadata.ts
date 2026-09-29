import { Request } from 'express';

export type Metadata = {
  ip: string;
  origin: string | null;
};

export function getRequestMetadata(request: Request): Metadata {
  return {
    ip: request.ip || 'undefined',
    origin: request.header('origin') || null,
  };
}
