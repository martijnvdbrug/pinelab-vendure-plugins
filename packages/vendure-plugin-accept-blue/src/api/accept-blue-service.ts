import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Customer,
  CustomerService,
  EntityHydrator,
  ID,
  Order,
  OrderLine,
  PaymentMethod,
  PaymentMethodService,
  ProductVariantService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { SubscriptionHelper } from '../';
import { AcceptBluePluginOptions } from '../accept-blue-plugin';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import {
  AcceptBlueCardPaymentMethod,
  AcceptBlueCheckChargeTransactionInput,
  AcceptBlueCreditCardChargeTransactionInput,
  AcceptBluePaymentMethod,
  AcceptBlueRecurringSchedule,
  AcceptBlueTokenizedCreditCardChargeTransactionInput,
  CheckPaymentInput,
  CreditCardPaymentInput,
  HandlePaymentResult,
  TokenPaymentMethodInput,
} from '../types';
import {
  getNrOfBillingCyclesLeft,
  isSameCard,
  isToday,
  toAcceptBlueFrequency,
} from '../util';
import { AcceptBlueClient } from './accept-blue-client';
import { acceptBluePaymentHandler } from './accept-blue-handler';

@Injectable()
export class AcceptBlueService {
  constructor(
    private readonly productVariantService: ProductVariantService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly customerService: CustomerService,
    private readonly entityHydrator: EntityHydrator,
    private connection: TransactionalConnection,
    moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: AcceptBluePluginOptions
  ) {
    this.subscriptionHelper = new SubscriptionHelper(
      loggerCtx,
      moduleRef,
      productVariantService,
      this.options.subscriptionStrategy
    );
  }

  readonly subscriptionHelper: SubscriptionHelper;

  /**
   * Handles credit card payments for order
   * 1. Get or Create customer
   * 2. Create payment method
   * Call payWithCardPaymentMethodDetails() to do the actual payment
   */
  async payWithCreditCard(
    ctx: RequestContext,
    order: Order,
    amount: number,
    client: AcceptBlueClient,
    ccDetails: CreditCardPaymentInput
  ): Promise<HandlePaymentResult> {
    if (!order.customer) {
      throw new UserInputError(`Order must have a customer`);
    }
    const customer = await client.getOrCreateCustomer(
      order.customer.emailAddress
    );
    if (!order.customer?.customFields?.activeBlueCustomerId) {
      await this.customerService.update(ctx, {
        id: order.customer?.id,
        customFields: { activeBlueCustomerId: customer.id },
      });
    }
    // Save payment method
    const paymentMethod = await client.getOrCreateCardPaymentMethod(
      customer.id,
      ccDetails
    );
    return await this.payWithCardPaymentMethodDetails(
      ctx,
      order,
      amount,
      client,
      paymentMethod.id,
      ccDetails
    );
  }

  async payWithToken(
    ctx: RequestContext,
    order: Order,
    amount: number,
    client: AcceptBlueClient,
    ccDetails: TokenPaymentMethodInput
  ): Promise<HandlePaymentResult> {
    if (!order.customer) {
      throw new UserInputError(`Order must have a customer`);
    }
    const customer = await client.getOrCreateCustomer(
      order.customer.emailAddress
    );
    if (!order.customer?.customFields?.activeBlueCustomerId) {
      await this.customerService.update(ctx, {
        id: order.customer?.id,
        customFields: { activeBlueCustomerId: customer.id },
      });
    }
    // Save payment method
    const methods = await client.getPaymentMethods(
      order.customer.customFields.activeBlueCustomerId
    );
    const paymentMethod = methods.find((method) =>
      isSameCard(ccDetails, method as AcceptBlueCardPaymentMethod)
    );
    if (!paymentMethod) {
      throw new UserInputError(
        'No Saved Credit Card with this toknized nonce code'
      );
    }
    return await this.payWithCardPaymentMethodDetails(
      ctx,
      order,
      amount,
      client,
      paymentMethod.id,
      ccDetails
    );
  }

  async payWithCheck(
    ctx: RequestContext,
    order: Order,
    amount: number,
    client: AcceptBlueClient,
    ccDetails: CheckPaymentInput
  ): Promise<HandlePaymentResult> {
    if (!order.customer) {
      throw new UserInputError(`Order must have a customer`);
    }
    const customer = await client.getOrCreateCustomer(
      order.customer.emailAddress
    );
    if (!order.customer?.customFields?.activeBlueCustomerId) {
      await this.customerService.update(ctx, {
        id: order.customer?.id,
        customFields: { activeBlueCustomerId: customer.id },
      });
    }
    // Save payment method
    const paymentMethod = await client.getOrCreateCheckPaymentMethod(
      customer.id,
      ccDetails
    );
    return await this.payWithCheckPaymentMethodDetails(
      ctx,
      order,
      amount,
      client,
      paymentMethod.id,
      ccDetails
    );
  }

  async payWithCardPaymentMethodDetails(
    ctx: RequestContext,
    order: Order,
    amountDueNow: number,
    client: AcceptBlueClient,
    paymentMethodId: number,
    ccDetails: CreditCardPaymentInput | TokenPaymentMethodInput
  ): Promise<HandlePaymentResult> {
    const recurringSchedules =
      await this.createRecurringPaymentScheduleForOrder(
        ctx,
        order,
        client,
        paymentMethodId
      );
    let creditCardChargeInput:
      | AcceptBlueCreditCardChargeTransactionInput
      | AcceptBlueTokenizedCreditCardChargeTransactionInput;
    if ((ccDetails as any).card) {
      creditCardChargeInput = {
        amount: amountDueNow,
        card: (ccDetails as CreditCardPaymentInput).card,
        expiry_month: ccDetails.expiry_month,
        expiry_year: ccDetails.expiry_year,
      };
    } else if ((ccDetails as any).source) {
      creditCardChargeInput = {
        amount: amountDueNow,
        source: (ccDetails as TokenPaymentMethodInput).source,
        expiry_month: ccDetails.expiry_month,
        expiry_year: ccDetails.expiry_year,
      };
    } else {
      throw new Error('Not Implemented');
    }
    const chargeResult = await client.createCharge(creditCardChargeInput);
    return {
      customerId: `${order?.customer?.customFields.activeBlueCustomerId}`,
      paymentMethodId,
      recurringScheduleResult: recurringSchedules,
      chargeResult,
    };
  }

  async payWithCheckPaymentMethodDetails(
    ctx: RequestContext,
    order: Order,
    amountDueNow: number,
    client: AcceptBlueClient,
    paymentMethodId: number,
    ccDetails: CheckPaymentInput
  ): Promise<HandlePaymentResult> {
    const recurringSchedules =
      await this.createRecurringPaymentScheduleForOrder(
        ctx,
        order,
        client,
        paymentMethodId
      );

    const creditCardChargeInput: AcceptBlueCheckChargeTransactionInput = {
      amount: amountDueNow,
      routing_number: ccDetails.routing_number,
      account_number: ccDetails.account_number,
      name: ccDetails.name,
    };
    const chargeResult = await client.createCharge(creditCardChargeInput);
    return {
      customerId: `${order?.customer?.customFields.activeBlueCustomerId}`,
      paymentMethodId,
      recurringScheduleResult: recurringSchedules,
      chargeResult,
    };
  }

  /**
   * Create recurring schedule for customer + with the saved payment method
   */
  async createRecurringPaymentScheduleForOrder(
    ctx: RequestContext,
    order: Order,
    client: AcceptBlueClient,
    paymentMethodId: number
  ): Promise<AcceptBlueRecurringSchedule[]> {
    if (!order.customer) {
      throw new UserInputError(
        `Order must have a customer before creating a payment`
      );
    }
    if (!order.customer.user) {
      // We don't want unregistered users to be able to use someone's email address to pay
      throw new UserInputError(
        `Saved payment methods can only be used for registered customers, ${order.customer.emailAddress} (customer ID ${order.customer.id}) is not a registered customer`
      );
    }
    const acceptBlueCustomer = await client.getCustomer(
      order.customer.emailAddress
    );
    if (!acceptBlueCustomer) {
      throw new UserInputError(
        `No customer found in Accept bBlue with email ${order.customer.emailAddress} not found`
      );
    }
    // Create recurring schedules
    const subscriptionDefinitions = (
      await this.subscriptionHelper.getSubscriptionsForOrder(ctx, order)
    ).map((subscription) => {
      // Mapping and validation for all subscriptions, before actually calling the Accept Blue API
      const {
        recurring: { startDate, endDate },
      } = subscription;
      // throws error if frequency can't be mapped
      const frequency = toAcceptBlueFrequency(subscription);
      // Get number of billing cycles if an end date is given
      const billingCyclesLeft = endDate
        ? getNrOfBillingCyclesLeft(startDate, endDate, frequency)
        : 0;
      // Only pass next_run_date if it's not today, because the API requires this date to be in the future
      const nextRunDate = isToday(startDate) ? undefined : startDate;
      return {
        ...subscription,
        frequency,
        billingCyclesLeft,
        nextRunDate,
      };
    });
    // Map<orderLineId, subscriptionIds> to save on orderLine custom field
    const subscriptionsPerOrderLine = new Map<ID, number[]>();
    const recurringSchedules: AcceptBlueRecurringSchedule[] = [];
    for (const subscriptionDefinition of subscriptionDefinitions) {
      const recurringSchedule = await client.createRecurringSchedule(
        acceptBlueCustomer.id,
        {
          title: subscriptionDefinition.name,
          active: true,
          amount: subscriptionDefinition.recurring.amount,
          frequency: subscriptionDefinition.frequency,
          num_left: subscriptionDefinition.billingCyclesLeft,
          payment_method_id: paymentMethodId,
          receipt_email: order.customer.emailAddress,
          next_run_date: subscriptionDefinition.nextRunDate,
        }
      );
      // Save subscriptionId for orderLine
      const subscriptionIds =
        subscriptionsPerOrderLine.get(subscriptionDefinition.orderLineId) ?? [];
      subscriptionIds.push(recurringSchedule.id);
      subscriptionsPerOrderLine.set(
        subscriptionDefinition.orderLineId,
        subscriptionIds
      );
      recurringSchedules.push(recurringSchedule);
    }
    await this.entityHydrator.hydrate(ctx, order, { relations: ['lines'] });
    // save subscription IDS on orderLine custom field
    const orderLineUpdatePromises = [];
    for (let orderLineId of subscriptionsPerOrderLine.keys()) {
      const orderLine = order.lines.find((l) => l.id === orderLineId);
      if (orderLine) {
        orderLine.customFields.subscriptionIds =
          subscriptionsPerOrderLine.get(orderLineId) ?? [];
        orderLineUpdatePromises.push(
          this.connection.getRepository(ctx, OrderLine).save(orderLine)
        );
      }
    }

    await Promise.all(orderLineUpdatePromises);
    return recurringSchedules;
  }

  /**
   * Get the payment methods stored in Accept Blue for the given customer
   */
  async getSavedPaymentMethods(
    ctx: RequestContext,
    customer: Customer
  ): Promise<AcceptBluePaymentMethod[]> {
    const client = await this.getClientForChannel(ctx);
    if (!ctx.activeUserId) {
      throw new Error(`User is not logged in!`);
    }
    if (!customer) {
      throw new Error(`No customer found for user ${ctx.activeUserId}`);
    }
    return await client.getPaymentMethods(
      customer.customFields.activeBlueCustomerId
    );
    // throw new Error('NOT IMPLEMENT');
  }

  async getClientForChannel(ctx: RequestContext): Promise<AcceptBlueClient> {
    const acceptBlueMethod = await this.getAcceptBlueMethod(ctx);
    const apiKey = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'apiKey'
    )?.value;
    const pin = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'pin'
    )?.value;

    if (!apiKey) {
      throw new Error(
        `No apiKey or pin found on configured Accept Blue payment method`
      );
    }
    return new AcceptBlueClient(apiKey, pin);
  }

  async getHostedTokenizationKey(ctx: RequestContext): Promise<string | null> {
    const acceptBlueMethod = await this.getAcceptBlueMethod(ctx);
    const tokenizationSourceKey = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'tokenizationSourceKey'
    )?.value;
    return tokenizationSourceKey ?? null;
  }

  async getAcceptBlueMethod(ctx: RequestContext): Promise<PaymentMethod> {
    const methods = await this.paymentMethodService.findAll(ctx, {
      filter: {
        enabled: { eq: true },
      },
    });
    const acceptBlueMethod = methods.items.find(
      (m) => m.handler.code === acceptBluePaymentHandler.code
    );
    if (!acceptBlueMethod) {
      throw new Error(
        `No enabled payment method found with code ${acceptBluePaymentHandler.code}`
      );
    }
    return acceptBlueMethod;
  }
}
