import { GroupingProvider } from 'gatex-express';
import health from './routes/health';

const provider = new GroupingProvider();

provider.group('/', (group: GroupingProvider) => {
  health(group);
});

export const httpProvider = provider;
