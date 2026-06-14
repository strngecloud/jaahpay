import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logs all HTTP requests and responses for audit trail
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, headers } = request;
        const userAddress = body?.userAddress || 'unknown';
        const startTime = Date.now();

        // Log request
        this.logger.log(
            `→ ${method} ${url} | User: ${userAddress} | IP: ${request.ip}`,
        );

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const duration = Date.now() - startTime;
                    this.logger.log(
                        `← ${method} ${url} | ${duration}ms | Success`,
                    );
                },
                error: (error) => {
                    const duration = Date.now() - startTime;
                    this.logger.error(
                        `← ${method} ${url} | ${duration}ms | Error: ${error.message}`,
                    );
                },
            }),
        );
    }
}
