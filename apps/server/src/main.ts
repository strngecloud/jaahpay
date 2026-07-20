import { setDefaultResultOrder } from 'dns';
import { setDefaultAutoSelectFamily } from 'net';

// This environment's IPv6 route is dead (DNS returns a NAT64 address that
// times out). Node's Happy Eyeballs (RFC 8305) races the IPv4 and IPv6
// connection attempts together, and the dead IPv6 attempt drags the whole
// race down, so even the working IPv4 leg times out — every outbound
// fetch/axios call (RPC polling, bank logo lookups, provider APIs) fails
// with a generic "fetch failed" / AggregateError. Must run before any
// other import that might open a connection at module-init time.
setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamily(false);

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    // Keep the raw request body so webhook HMAC signatures can be verified
    // over the exact bytes the provider signed.
    rawBody: true,
  });

  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Trust the first proxy hop so req.ip (used for rate limiting) is the
  // client address, not the load balancer's.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // CORS configuration - comma-separated origins from env, localhost fallback
  const corsOrigins = (
    configService.get<string>('CORS_ORIGINS') ||
    'http://localhost:3000,http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // API prefix
  const apiPrefix = configService.get('API_PREFIX') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Start server
  const port = configService.get('PORT') || 3001;
  await app.listen(port);

  logger.log(`🚀 Server is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📊 Environment: ${configService.get('NODE_ENV')}`);
  logger.log(`💾 Database: ${configService.get('DATABASE_NAME')}`);
}

bootstrap();
