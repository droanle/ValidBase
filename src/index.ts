import { httpProvider } from './http';
import { Application } from 'express';

export default function init(app: Application) {
  httpProvider.finish(app);
}
