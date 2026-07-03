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

  // CORS configuration
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      // Add your frontend URLs here
    ],
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
