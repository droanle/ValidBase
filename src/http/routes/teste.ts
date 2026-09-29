import { GroupingProvider } from 'gatex-express';
import sessionMiddleware from '../middlewares/Session.middleware';

export default function (provider: GroupingProvider) {
  provider.get('/session', sessionMiddleware, (req, res) => {
    console.log(req.session);

    res.json({
      session: {
        account: req.session?.accountSession,
        access: req.session?.accessSession,
      },
    });
  });
}
