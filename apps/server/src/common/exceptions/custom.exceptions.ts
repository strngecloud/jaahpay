import { HttpException, HttpStatus } from '@nestjs/common';

export class SpendNotFoundException extends HttpException {
    constructor(spendId: string) {
        super(
            {
                statusCode: HttpStatus.NOT_FOUND,
                message: `Spend transaction with ID ${spendId} not found`,
                error: 'SpendNotFound',
            },
            HttpStatus.NOT_FOUND,
        );
    }
}

export class SpendLimitExceededException extends HttpException {
    constructor(limitType: 'daily' | 'monthly', limit: number, current: number) {
        super(
            {
                statusCode: HttpStatus.FORBIDDEN,
                message: `${limitType.charAt(0).toUpperCase() + limitType.slice(1)} spending limit exceeded. Limit: $${limit}, Current: $${current}`,
                error: 'SpendLimitExceeded',
                data: { limitType, limit, current },
            },
            HttpStatus.FORBIDDEN,
        );
    }
}

export class InvalidAccountException extends HttpException {
    constructor(accountNumber: string, bankCode: string) {
        super(
            {
                statusCode: HttpStatus.BAD_REQUEST,
                message: `Invalid account: ${accountNumber} at bank ${bankCode}`,
                error: 'InvalidAccount',
            },
            HttpStatus.BAD_REQUEST,
        );
    }
}

export class BankApiException extends HttpException {
    constructor(provider: string, message: string, originalError?: any) {
        super(
            {
                statusCode: HttpStatus.SERVICE_UNAVAILABLE,
                message: `Bank API error (${provider}): ${message}`,
                error: 'BankApiError',
                provider,
                details: originalError?.message || originalError,
            },
            HttpStatus.SERVICE_UNAVAILABLE,
        );
    }
}

export class ExchangeRateException extends HttpException {
    constructor(message: string) {
        super(
            {
                statusCode: HttpStatus.SERVICE_UNAVAILABLE,
                message: `Exchange rate error: ${message}`,
                error: 'ExchangeRateError',
            },
            HttpStatus.SERVICE_UNAVAILABLE,
        );
    }
}

export class BlockchainException extends HttpException {
    constructor(chain: string, message: string, originalError?: any) {
        super(
            {
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                message: `Blockchain error on ${chain}: ${message}`,
                error: 'BlockchainError',
                chain,
                details: originalError?.message || originalError,
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
}

export class SpendAlreadyProcessedException extends HttpException {
    constructor(spendId: string, currentStatus: string) {
        super(
            {
                statusCode: HttpStatus.CONFLICT,
                message: `Spend ${spendId} has already been processed with status: ${currentStatus}`,
                error: 'SpendAlreadyProcessed',
                currentStatus,
            },
            HttpStatus.CONFLICT,
        );
    }
}

export class SpendTimeoutException extends HttpException {
    constructor(spendId: string) {
        super(
            {
                statusCode: HttpStatus.REQUEST_TIMEOUT,
                message: `Spend transaction ${spendId} timed out`,
                error: 'SpendTimeout',
            },
            HttpStatus.REQUEST_TIMEOUT,
        );
    }
}

export class InsufficientBalanceException extends HttpException {
    constructor(required: number, available: number) {
        super(
            {
                statusCode: HttpStatus.BAD_REQUEST,
                message: `Insufficient balance. Required: $${required}, Available: $${available}`,
                error: 'InsufficientBalance',
                data: { required, available },
            },
            HttpStatus.BAD_REQUEST,
        );
    }
}

export class FraudCheckException extends HttpException {
    constructor(message: string, riskScore?: number) {
        super(
            {
                statusCode: HttpStatus.FORBIDDEN,
                message: `Fraud check failed: ${message}`,
                error: 'FraudCheckFailed',
                riskScore,
            },
            HttpStatus.FORBIDDEN,
        );
    }
}

export class WebhookVerificationException extends HttpException {
    constructor(provider: string) {
        super(
            {
                statusCode: HttpStatus.UNAUTHORIZED,
                message: `Webhook signature verification failed for ${provider}`,
                error: 'WebhookVerificationFailed',
                provider,
            },
            HttpStatus.UNAUTHORIZED,
        );
    }
}
