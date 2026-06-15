import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
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
    @Body() payload: any,
    @Headers('x-wema-signature') signature: string,
    @Headers('x-webhook-id') webhookId: string,
  ) {
    this.logger.log(`Received Wema webhook: ${webhookId || 'no-id'}`);

    try {
      // Verify signature
      const isValid = await this.webhooksService.verifyWemaSignature(
        payload,
        signature,
      );

      if (!isValid) {
        this.logger.error('Invalid Wema webhook signature');
        throw new UnauthorizedException('Invalid signature');
      }

      // Process webhook
      await this.webhooksService.processWemaWebhook(payload);

      return { status: 'received', webhookId };
    } catch (error) {
      this.logger.error('Error processing Wema webhook:', error);
      // Still return 200 to prevent bank retries
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Paystack webhook endpoint
   * POST /api/v1/webhooks/paystack
   */
  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  async handlePaystackWebhook(
    @Body() payload: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    this.logger.log(`Received Paystack webhook: ${payload.event}`);

    try {
      // Verify signature
      const isValid = await this.webhooksService.verifyPaystackSignature(
        payload,
        signature,
      );

      if (!isValid) {
        this.logger.error('Invalid Paystack webhook signature');
        throw new UnauthorizedException('Invalid signature');
      }

      // Process webhook
      await this.webhooksService.processPaystackWebhook(payload);

      return { status: 'success' };
    } catch (error) {
      this.logger.error('Error processing Paystack webhook:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Health check endpoint for webhooks
   * GET /api/v1/webhooks/health
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
