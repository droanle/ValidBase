import { Application } from 'express';
import processErrorHandler from '../utils/erros/process-error-handler';

export default function (app: Application) {
  app.use(processErrorHandler);
}
