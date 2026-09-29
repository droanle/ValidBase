import { Application, json } from 'express';

export default function (app: Application) {
  app.use(json());
}
