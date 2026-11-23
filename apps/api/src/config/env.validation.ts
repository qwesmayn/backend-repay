import { z } from 'zod';

export const WORKER_ROLES = [
  'detector',
  'sweeper',
  'indexer',
  'keeper',
  'webhooks',
] as const;
export type WorkerRole = (typeof WORKER_ROLES)[number];

/** "keeper, sweeper" → ['keeper', 'sweeper']; пусто → все роли. Бросает на неизвестной роли. */
export function parseWorkerRoles(raw: string | undefined): WorkerRole[] {
  const roles = (raw ?? '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
  const unknown = roles.filter(
    (role) => !(WORKER_ROLES as readonly string[]).includes(role),
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unknown worker role(s): ${unknown.join(', ')}. Allowed: ${WORKER_ROLES.join(', ')}`,
    );
  }
  return roles.length === 0
    ? [...WORKER_ROLES]
    : [...new Set(roles as WorkerRole[])];
}

const port = z.coerce.number().int().min(1).max(65535);

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: port.default(3000),

  DB_HOST: z.string().min(1),
  DB_PORT: port.default(5432),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_DATABASE: z.string().min(1),

  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: port.default(6379),
  // Пустая строка (REDIS_PASSWORD= в .env) = без пароля.
  REDIS_PASSWORD: z
    .string()
    .optional()
    .transform((value) => value || undefined),

  WORKER_ROLES: z
    .string()
    .default('')
    .superRefine((raw, ctx) => {
      try {
        parseWorkerRoles(raw);
      } catch (error) {
        ctx.addIssue({ code: 'custom', message: (error as Error).message });
      }
    }),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}
