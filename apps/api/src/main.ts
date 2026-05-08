import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8080',
];

export function getCorsOrigins() {
  return (process.env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getApiPort() {
  const value = process.env.API_PORT;

  if (!value) {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('API_PORT must be a positive integer');
  }

  return port;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: getCorsOrigins(), credentials: true });
  await app.listen(getApiPort());
}

if (require.main === module) {
  void bootstrap();
}
