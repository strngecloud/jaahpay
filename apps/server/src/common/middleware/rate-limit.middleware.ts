import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly WINDOW_SIZE_SECONDS = 60;
  private readonly MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute per IP

  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:${ip}`;

    try {
      const current = await this.redisService.incr(key);

      if (current === 1) {
        // First request in window, set expiry
        await this.redisService.expire(key, this.WINDOW_SIZE_SECONDS);
      }

      if (current > this.MAX_REQUESTS_PER_WINDOW) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests, please try again later',
            error: 'RateLimitExceeded',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', this.MAX_REQUESTS_PER_WINDOW);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, this.MAX_REQUESTS_PER_WINDOW - current),
      );
      res.setHeader(
        'X-RateLimit-Reset',
        Date.now() + this.WINDOW_SIZE_SECONDS * 1000,
      );

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If Redis fails, allow request through (fail-open)
      next();
    }
  }
}
