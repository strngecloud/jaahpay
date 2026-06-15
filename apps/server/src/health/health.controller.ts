import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV'),
      version: '1.0.0',
    };
  }

  @Get('ready')
  getReady() {
    // Add checks for database, redis, etc. if needed
    return {
      ready: true,
      checks: {
        database: 'ok',
        redis: 'ok',
      },
    };
  }
}
