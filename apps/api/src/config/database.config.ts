import { registerAs } from '@nestjs/config';
import { loadEnv } from './env.validation.js';

export default registerAs('database', () => {
  const env = loadEnv();
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  };
});
