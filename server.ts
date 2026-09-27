import 'reflect-metadata';
import { app } from './app';
import { initDatabases } from './src/database';

const port: number = process.env.API_PORT
  ? parseInt(process.env.API_PORT, 10)
  : 3000;

async function startServer() {
  await initDatabases();

  app
    .listen(port, 'localhost', () =>
      console.info(`>> Server running on: http://localhost:${port}`)
    )
    .on('error', (err: any) => {
      if (err.code === 'EADDRINUSE')
        console.error('>> Server startup error: address already in use');
      else console.error(err);
    });
}

startServer().catch((error: Error) => {
  console.error('>> Server startup error:', error);
  process.exit(1);
});
