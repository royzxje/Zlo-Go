import { DEFAULT_CORS_ORIGINS, getApiPort, getCorsOrigins } from './main';

describe('bootstrap configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.API_PORT;
    delete process.env.CORS_ORIGINS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses explicit local CORS origins by default', () => {
    expect(getCorsOrigins()).toEqual(DEFAULT_CORS_ORIGINS);
  });

  it('parses CORS_ORIGINS as a comma-separated allowlist', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com, http://localhost:5173,,';

    expect(getCorsOrigins()).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
    ]);
  });

  it('defaults API_PORT to 3000', () => {
    expect(getApiPort()).toBe(3000);
  });

  it('parses API_PORT as a positive integer', () => {
    process.env.API_PORT = '8080';

    expect(getApiPort()).toBe(8080);
  });

  it.each(['abc', '0', '-1', '1.5'])('rejects invalid API_PORT %s', (value) => {
    process.env.API_PORT = value;

    expect(() => getApiPort()).toThrow('API_PORT must be a positive integer');
  });
});
