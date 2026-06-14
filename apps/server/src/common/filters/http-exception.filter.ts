import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let error = 'InternalServerError';
        let details: any = undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'object') {
                const response = exceptionResponse as any;
                message = response.message || exception.message;
                error = response.error || exception.name;
                details = response.data || response.details;
            } else {
                message = exceptionResponse as string;
                error = exception.name;
            }
        } else if (exception instanceof Error) {
            message = exception.message;
            error = exception.name;
            this.logger.error(
                `Unhandled exception: ${exception.message}`,
                exception.stack,
            );
        }

        const errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            error,
            message,
            ...(details && { details }),
        };

        // Log error for monitoring
        if (status >= 500) {
            this.logger.error(
                `HTTP ${status} Error: ${JSON.stringify(errorResponse)}`,
                exception instanceof Error ? exception.stack : undefined,
            );
        } else {
            this.logger.warn(`HTTP ${status} Error: ${JSON.stringify(errorResponse)}`);
        }

        response.status(status).json(errorResponse);
    }
}
