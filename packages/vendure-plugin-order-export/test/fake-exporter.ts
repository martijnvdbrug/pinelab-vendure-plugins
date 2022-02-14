import { ExportResult, OrderExportArgument, OrderExportStrategy } from '../src';
import { Order } from '@vendure/core';

export class FakeExporter implements OrderExportStrategy {
  name = 'Fake importer';
  async exportOrder(
    args: OrderExportArgument[],
    order: Order
  ): Promise<ExportResult> {
    console.log(`I got this order ${order.code}`);
    return {
      message: 'OKEE',
      reference: '2',
    };
  }

  arguments: OrderExportArgument[] = [
    {
      name: 'fake-input-argument',
      value: 'place-holder-value',
    },
  ];
}
