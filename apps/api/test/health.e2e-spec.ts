import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DB } from '../src/database/database.module.js';

describe('Health (e2e, без реальной БД)', () => {
  let app: INestApplication;
  const execute = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DB)
      .useValue({ execute })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live → 200', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200, { status: 'ok' });
  });

  it('GET /health/ready → 200 when Postgres answers', async () => {
    execute.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200, { status: 'ok', checks: { postgres: 'up' } });
  });

  it('GET /health/ready → 503 when Postgres is down', async () => {
    execute.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
    expect(res.body).toMatchObject({ checks: { postgres: 'down' } });
  });
});
