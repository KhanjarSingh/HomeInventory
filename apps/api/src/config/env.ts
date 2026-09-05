import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root if available
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars').default('development_jwt_secret_key_12345'),
  REFRESH_TOKEN_SECRET: z.string().min(16).default('development_refresh_token_secret_12345'),
  COOKIE_SECRET: z.string().min(16).default('development_cookie_secret_key_12345'),
  CLOUDINARY_CLOUD_NAME: z.string().default('home-inventory'),
  CLOUDINARY_API_KEY: z.string().default('312656818394283'),
  CLOUDINARY_API_SECRET: z.string().default('XX03Or4ARCe_8u1SAiv9ER4ughQ'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
