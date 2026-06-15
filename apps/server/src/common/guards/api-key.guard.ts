import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * API Key Guard for sensitive admin endpoints
 * Usage: @UseGuards(ApiKeyGuard)
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const apiKey = request.headers['x-api-key'] as string;

        const validApiKey = this.configService.get<string>('ADMIN_API_KEY');

        if (!validApiKey) {
            // If no API key configured, allow through (for development)
            return true;
        }

        if (!apiKey || apiKey !== validApiKey) {
            throw new UnauthorizedException('Invalid or missing API key');
        }

        return true;
    }
}
