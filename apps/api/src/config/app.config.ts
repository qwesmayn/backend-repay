import { registerAs } from '@nestjs/config';
import { loadEnv } from './env.validation.js';

export default registerAs('app', () => {
  const env = loadEnv();
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
  };
});
