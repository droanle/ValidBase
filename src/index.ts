import { httpProvider } from './http';
import { Application } from 'express';
import zodErrorHandler from './utils/erros/zod-error-handler';
import setResponseError from './bootstrap/set-response-error';
import setRequestBodyParser from './bootstrap/set-request-body-parser';
import setSecureConfig from './bootstrap/set-secure-config';

export default function init(app: Application) {
  setSecureConfig(app);
  setRequestBodyParser(app);

  httpProvider.schemeErrorHandler = zodErrorHandler;

  httpProvider.finish(app);

  setResponseError(app);
}
