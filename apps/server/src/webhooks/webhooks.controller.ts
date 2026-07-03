import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
  RawBodyRequest,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Wema Bank webhook endpoint
   * POST /api/v1/webhooks/wema
   */
  @Post('wema')
  @HttpCode(HttpStatus.OK)
  async handleWemaWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: any,
    @Headers('x-wema-signature') signature: string,
    @Headers('x-webhook-id') webhookId: string,
  ) {
    this.logger.log(`Received Wema webhook: ${webhookId || 'no-id'}`);

    const isValid = this.webhooksService.verifyWemaSignature(
      req.rawBody,
      signature,
    );

    if (!isValid) {
      this.logger.error('Invalid Wema webhook signature');
      throw new UnauthorizedException('Invalid signature');
    }

    // Let processing errors surface as 5xx so the bank retries the webhook.
    await this.webhooksService.processWemaWebhook(payload);

    return { status: 'received', webhookId };
  }

  /**
   * Paystack webhook endpoint
   * POST /api/v1/webhooks/paystack
   */
  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  async handlePaystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    this.logger.log(`Received Paystack webhook: ${payload.event}`);

    const isValid = this.webhooksService.verifyPaystackSignature(
      req.rawBody,
      signature,
    );

    if (!isValid) {
      this.logger.error('Invalid Paystack webhook signature');
      throw new UnauthorizedException('Invalid signature');
    }

    // Let processing errors surface as 5xx so Paystack retries the webhook.
    await this.webhooksService.processPaystackWebhook(payload);

    return { status: 'success' };
  }

  /**
   * Health check endpoint for webhooks
   * GET /api/v1/webhooks/health
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
