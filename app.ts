import 'reflect-metadata';
import { config as dotenv } from 'dotenv';
import express, { Application } from 'express';
import init from './src';
import Session from './src/utils/Session';

dotenv();

declare global {
  namespace Express {
    export interface Request {
      session?: Session | undefined;
    }
  }
}

const app: Application = express();

init(app);

export { app };
