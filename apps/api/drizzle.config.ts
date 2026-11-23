import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile();
} catch {
  // .env не обязателен: в CI/проде переменные приходят из окружения
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE ?? '',
    ssl: false,
  },
  strict: true,
});
