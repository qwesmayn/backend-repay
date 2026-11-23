import { registerAs } from '@nestjs/config';
import { loadEnv, parseWorkerRoles } from './env.validation.js';

export default registerAs('worker', () => ({
  roles: parseWorkerRoles(loadEnv().WORKER_ROLES),
}));
