import { GroupingProvider } from 'gatex-express';
import health from './routes/health';
import auth from './routes/auth';
import teste from './routes/teste';

const provider = new GroupingProvider();

provider.group('/', (group: GroupingProvider) => {
  health(group);
});

provider.group('/auth', auth);

provider.group('/test', (group: GroupingProvider) => {
  teste(group);
});

export const httpProvider = provider;
