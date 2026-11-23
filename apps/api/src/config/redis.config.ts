import { registerAs } from '@nestjs/config';
import { loadEnv } from './env.validation.js';

export default registerAs('redis', () => {
  const env = loadEnv();
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  };
});
