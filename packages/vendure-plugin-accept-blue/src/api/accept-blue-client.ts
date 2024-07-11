import { Logger } from '@vendure/core';
import axios, { AxiosInstance } from 'axios';
import util from 'util';
import { loggerCtx } from '../constants';
import {
  AcceptBlueChargeTransaction,
  AcceptBlueCustomer,
  AcceptBluePaymentMethod,
  AcceptBlueRecurringSchedule,
  AcceptBlueRecurringScheduleInput,
  AcceptBlueRecurringScheduleTransaction,
  CheckPaymentMethodInput,
  NoncePaymentMethodInput,
  AcceptBlueTransaction,
  AcceptBlueWebhookInput,
  AcceptBlueWebhook,
} from '../types';
import { isSameCard, isSameCheck } from '../util';

export class AcceptBlueClient {
  readonly endpoint: string;
  readonly instance: AxiosInstance;

  constructor(
    public readonly apiKey: string,
    public readonly pin: string = '',
    public readonly testMode?: boolean
  ) {
    if (this.testMode) {
      this.endpoint = 'https://api.develop.accept.blue/api/v2/';
      Logger.warn(`Using Accept Blue in test mode`, loggerCtx);
    } else {
      this.endpoint = 'https://api.accept.blue/api/v2/';
      Logger.debug(`Using Accept Blue in live mode`, loggerCtx);
    }
    this.instance = axios.create({
      baseURL: `${this.endpoint}`,
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(
          `${this.apiKey}:${this.pin}`
        ).toString('base64')}`,
      },
      validateStatus: () => true,
    });
  }

  async getTransaction(id: number): Promise<AcceptBlueChargeTransaction> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.request('get', `transactions/${id}`);
  }

  async getOrCreateCustomer(emailAddress: string): Promise<AcceptBlueCustomer> {
    const existing = await this.getCustomer(emailAddress);
    if (existing) {
      return existing;
    } else {
      Logger.info(`Creating new customer ${emailAddress}`, loggerCtx);
      return await this.createCustomer(emailAddress);
    }
  }

  async getCustomer(
    emailAddress: string
  ): Promise<AcceptBlueCustomer | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const customers = await this.request(
      'get',
      `customers?active=true&customer_number=${emailAddress}`
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (customers.length > 1) {
      throw Error(
        `Multiple customers found for email '${emailAddress}' in Accept Blue. There should be only one.`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (customers[0]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return customers[0];
    }
    return undefined;
  }

  async createCustomer(emailAddress: string): Promise<AcceptBlueCustomer> {
    const customer: Partial<AcceptBlueCustomer> = {
      identifier: emailAddress,
      customer_number: emailAddress,
      email: emailAddress,
      active: true,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.request('post', 'customers', customer);
    Logger.info(`Created new customer '${emailAddress}'`, loggerCtx);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  async getOrCreatePaymentMethod(
    acceptBlueCustomerId: number,
    input: NoncePaymentMethodInput | CheckPaymentMethodInput
  ): Promise<AcceptBluePaymentMethod> {
    const methods = await this.getPaymentMethods(acceptBlueCustomerId);
    const existing = methods.find((method) => {
      if (
        (input as NoncePaymentMethodInput).source &&
        method.payment_method_type === 'card'
      ) {
        return isSameCard(input as NoncePaymentMethodInput, method);
      } else if (
        (input as CheckPaymentMethodInput).account_number &&
        method.payment_method_type === 'check'
      ) {
        return isSameCheck(input as CheckPaymentMethodInput, method);
      }
      return false;
    });
    if (existing) {
      return existing;
    }
    return await this.createPaymentMethod(acceptBlueCustomerId, input);
  }

  async getRecurringSchedules(
    ids: number[]
  ): Promise<AcceptBlueRecurringSchedule[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await Promise.all(
      ids.map(async (id) => this.request('get', `recurring-schedules/${id}`))
    );
  }

  async getTransactionsForRecurringSchedule(
    id: number
  ): Promise<AcceptBlueRecurringScheduleTransaction[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.request('get', `recurring-schedules/${id}/transactions`);
  }

  async getPaymentMethods(
    acceptBlueCustomerId: number
  ): Promise<AcceptBluePaymentMethod[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.request(
      'get',
      `customers/${acceptBlueCustomerId}/payment-methods?limit=100`
    );
    if (!result) {
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (result.length === 100) {
      throw Error(
        `Customer has more than 100 payment methods. Pagination is not implemented yet...`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  async createPaymentMethod(
    acceptBlueCustomerId: number,
    input: NoncePaymentMethodInput | CheckPaymentMethodInput
  ): Promise<AcceptBluePaymentMethod> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result: AcceptBluePaymentMethod = await this.request(
      'post',
      `customers/${acceptBlueCustomerId}/payment-methods`,
      input
    );
    Logger.info(
      `Created payment method '${result.payment_method_type}' (${result.id}) for customer '${result.customer_id}'`,
      loggerCtx
    );
    return result;
  }

  async createRecurringSchedule(
    customerId: number,
    input: AcceptBlueRecurringScheduleInput
  ): Promise<AcceptBlueRecurringSchedule> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result: AcceptBlueRecurringSchedule = await this.request(
      'post',
      `customers/${customerId}/recurring-schedules`,
      {
        ...input,
        // Accept Blue requires dates to be in 'yyyy-mm-dd' format
        next_run_date: input.next_run_date
          ? this.toDateString(input.next_run_date)
          : undefined,
      }
    );
    Logger.info(
      `Created recurring schedule ${result.id} for customer '${result.customer_id}'`,
      loggerCtx
    );
    return result;
  }

  /**
   * Only supports charge with saved payment method id
   */
  async createCharge(
    /**
     * ID without the `pm-` prefix
     */
    paymentMethodId: number,
    amountInCents: number
  ): Promise<AcceptBlueChargeTransaction> {
    const amount = amountInCents / 100;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.request('post', `transactions/charge`, {
      source: `pm-${paymentMethodId}`,
      amount,
    });
    if (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      result.status === 'Error' ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      result.status === 'Declined'
    ) {
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `One time charge creation failed: ${result.error_message} (${result.error_code})`
      );
    }
    Logger.info(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      `Created charge of '${amount}' with id '${result.transaction.id}'`,
      loggerCtx
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  /**
   * Refund a transaction
   * @param transactionId The transaction ID to refund
   * @param amountToRefundInCents Optionally provide an amount to refund
   * @param cvv2 Optionally provide the CVV/CVC code to prevent fraud detection
   * @returns
   */
  async refund(
    transactionId: number,
    amountToRefundInCents?: number,
    cvv2?: string
  ): Promise<AcceptBlueTransaction> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {};
    if (amountToRefundInCents) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      options.amount = amountToRefundInCents / 100;
    }
    if (cvv2) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      options.cvv2 = cvv2;
    }
    const result = (await this.request('post', `transactions/refund`, {
      reference_number: transactionId,
      ...options,
    })) as AcceptBlueTransaction;
    if (
      result.status === 'Approved' ||
      result.status === 'Partially Approved'
    ) {
      Logger.info(
        `Refunded transaction ${transactionId}. Status: ${result.status}`,
        loggerCtx
      );
    } else {
      Logger.info(
        `Failed to refund transaction ${transactionId}: [${result.error_code}] ${result.error_message}. Status: ${result.status}`,
        loggerCtx
      );
    }
    return result;
  }

  async createWebhook(
    input: AcceptBlueWebhookInput
  ): Promise<AcceptBlueWebhook> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.request('post', 'webhooks', input);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  async getWebhooks(): Promise<AcceptBlueWebhook[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.request('get', 'webhooks');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  async request(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const result = await this.instance[method](`/${path}`, data);
    if (result.status === 404) {
      Logger.debug(
        `No result found for ${method} to "${path}", returning undefined`,
        loggerCtx
      );
      return undefined;
    }
    if (result.status >= 400) {
      Logger.error(
        `${method} to "${path}" resulted in: ${result.status} (${
          result.statusText
        }): ${util.inspect(result.data)}`,
        loggerCtx,
        util.inspect(result.data)
      );
      throw Error(result.statusText);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result.data;
  }

  /**
   * Transform date to 'yyyy-mm-dd' format for Accept Blue
   */
  toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
