import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Health Check API', () => {
  const app = createApp();

  it('GET /health returns health metrics in standard envelope', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.data.version).toBe('0.1.0');
    expect(res.body.data.services).toHaveProperty('database');
    expect(res.body.data.services).toHaveProperty('cloudinary');
    expect(res.body.meta).toHaveProperty('requestId');
  });

  it('GET /api/v1/health returns identical status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /non-existent-route returns structured 404 AppError', async () => {
    const res = await request(app).get('/api/v1/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.meta).toHaveProperty('requestId');
  });
});
