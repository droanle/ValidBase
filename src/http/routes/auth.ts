import { GroupingProvider } from 'gatex-express';
import { z } from 'zod';
import authController from '../controllers/Auth.controller';

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254, 'E-mail too long.')
    .toLowerCase()
    .check(z.email('Invalid E-mail')),
  password: z.string().min(6).max(72),
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254, 'E-mail too long.')
    .toLowerCase()
    .check(z.email('Invalid E-mail')),
  password: z.string().max(100),
});

export default function (provider: GroupingProvider) {
  provider.post('/register', registerSchema, authController.register);
  provider.post('/login', loginSchema, authController.login);
}
