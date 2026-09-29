import { Response } from 'express';

export default function (
  response: Response,
  success: boolean,
  message: string,
  content: any = null,
  status?: number
) {
  if (!status) status = success ? 200 : 400;

  return response.status(status).json({
    success,
    message,
    content: content ?? undefined,
  });
}
