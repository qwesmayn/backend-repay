import { envSchema, parseWorkerRoles, WORKER_ROLES } from './env.validation.js';

const base = {
  DB_HOST: 'localhost',
  DB_USERNAME: 'repay',
  DB_PASSWORD: 'repay',
  DB_DATABASE: 'repay',
};

describe('envSchema', () => {
  it('applies defaults', () => {
    const env = envSchema.parse(base);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      DB_PORT: 5432,
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      WORKER_ROLES: '',
    });
  });

  it('coerces ports from strings', () => {
    const env = envSchema.parse({ ...base, PORT: '8080', DB_PORT: '5433', REDIS_PORT: '6380' });
    expect([env.PORT, env.DB_PORT, env.REDIS_PORT]).toEqual([8080, 5433, 6380]);
  });

  it.each(['DB_HOST', 'DB_USERNAME', 'DB_DATABASE'])('requires %s', (key) => {
    const result = envSchema.safeParse({ ...base, [key]: undefined });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([key]);
  });

  it('rejects out-of-range port', () => {
    expect(envSchema.safeParse({ ...base, DB_PORT: '70000' }).success).toBe(false);
  });

  it('treats empty REDIS_PASSWORD as no password', () => {
    expect(envSchema.parse({ ...base, REDIS_PASSWORD: '' }).REDIS_PASSWORD).toBeUndefined();
    expect(envSchema.parse({ ...base, REDIS_PASSWORD: 's3cret' }).REDIS_PASSWORD).toBe('s3cret');
  });

  it('rejects unknown worker role', () => {
    const result = envSchema.safeParse({ ...base, WORKER_ROLES: 'keeper,miner' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('miner');
  });
});

describe('parseWorkerRoles', () => {
  it('parses, trims and dedupes', () => {
    expect(parseWorkerRoles(' keeper, sweeper ,keeper,')).toEqual(['keeper', 'sweeper']);
  });

  it('treats empty value as all roles', () => {
    expect(parseWorkerRoles('')).toEqual([...WORKER_ROLES]);
    expect(parseWorkerRoles(undefined)).toEqual([...WORKER_ROLES]);
  });

  it('throws on unknown role', () => {
    expect(() => parseWorkerRoles('miner')).toThrow(/miner/);
  });
});
