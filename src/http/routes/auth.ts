import { GroupingProvider } from 'gatex-express';
import { z } from 'zod';
import authController from '../controllers/Auth.controller';
import rateLimitMiddleware from '../middlewares/RateLimiting.middleware';

const registerInput = z.object({
  email: z
    .string()
    .trim()
    .max(254, 'E-mail too long.')
    .toLowerCase()
    .check(z.email('Invalid E-mail')),
  password: z.string().min(6).max(72),
});

const loginInput = z.object({
  email: z
    .string()
    .trim()
    .max(254, 'E-mail too long.')
    .toLowerCase()
    .check(z.email('Invalid E-mail')),
  password: z.string().max(100),
});

// TODO: Definir parâmetros de rate limiting correta
export default function (provider: GroupingProvider) {
  provider.post(
    '/register',
    registerInput,
    rateLimitMiddleware('register', 5, 1),
    authController.register
  );
  provider.post(
    '/login',
    loginInput,
    rateLimitMiddleware('login', 5, 1),
    authController.login
  );
}
