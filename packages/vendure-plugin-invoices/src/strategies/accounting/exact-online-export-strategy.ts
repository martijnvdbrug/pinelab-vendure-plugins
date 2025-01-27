import { Injector, RequestContext, Order } from '@vendure/core';
import { InvoiceEntity } from '../../entities/invoice.entity';
import {
  AccountingExportStrategy,
  ExternalReference,
} from './accounting-export-strategy';
import { ExactOnlineClient } from './exact-online-client';

export interface ExactConfig {
  /**
   * When undefined, invoices for all channels will be synced to Exact
   */
  channelToken: string | undefined;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class ExactOnlineStrategy implements AccountingExportStrategy {
  readonly channelToken: string | undefined;
  readonly exactClient: ExactOnlineClient;

  constructor(private readonly config: ExactConfig) {
    this.channelToken = config.channelToken;
    this.exactClient = new ExactOnlineClient(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  async init() {
    // Check for custom field Channel.customFields.exactOnlineRefreshToken
    // If not exists, throw error, should prevent startup.
    // If exists, test if still valid, else throw error.
    // In both cases, mention startup script
  }

  exportInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    order: Order
  ): Promise<ExternalReference> | ExternalReference {
    throw new Error('Method not implemented.');
  }
  exportCreditInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    isCreditInvoiceFor: InvoiceEntity,
    order: Order
  ): Promise<ExternalReference> | ExternalReference {
    throw new Error('Method not implemented.');
  }
}
