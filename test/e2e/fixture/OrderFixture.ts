import { Collection } from 'mongodb';
import * as MUUID from 'uuid-mongodb';
import { InjectCollection } from 'nest-mongodb';

import { Order } from '../../../src/order/domain/entity/Order';
/* For TODO:
import { OrderRepositoryProvider } from '../../../src/order/infrastructure/di/OrderDiTokens';
import { OrderRepository } from '../../../src/order/application/port/OrderRepository';
import { OrderMongoRepositoryAdapter } from '../../../src/order/infrastructure/repository/order/OrderMongoRepositoryAdapter';
*/
import { OrderMongoDocument } from '../../../src/order/infrastructure/repository/order/OrderMongoMapper';
import { Customer } from '../../../src/order/domain/entity/Customer';
import { getRandomElement } from '../../../src/common/utils';
import {
  destinationCountriesAvailable,
  originCountriesAvailable,
} from '../../../src/order/application/services/MatchHostService';

export class OrderFixture {
  protected testOrder: Order;

  constructor(
    /* For TODO, add this
    private readonly testingModule: TestingModule,
    and remove orderCollection
     */
    @InjectCollection('orders')
    private readonly orderCollection: Collection<OrderMongoDocument>,
  ) {}

  async createTestOrder(
    fixtureCustomer: Customer,
    originCountry: string,
  ): Promise<Order> {
    const order: Order = await OrderFixture.createOrder(
      fixtureCustomer,
      originCountry,
    );
    const { id, customer, status, shipmentCost, ...orderDocumentBody } = order;

    /**
     * TODO: Insert order through OrderRepositoryProvider.
     * For that, add .addOrder() method to OrderRepository and its implementations.
     */
    await this.orderCollection.insertOne({
      status,
      shipmentCost,
      _id: MUUID.from(id.value),
      customerId: MUUID.from(customer.id.value),
      destination: order.destination,
      ...orderDocumentBody,
    });

    this.testOrder = order;
    return this.testOrder;
  }

  static async createOrder(
    customer: Customer,
    originCountry: string,
  ): Promise<Order> {
    const order = new Order({
      customer,
      items: [],
      originCountry,
    });

    await order.calculateShipmentCost({
      getRate: async () => ({ amount: 400, currency: 'usd' }),
    });

    return order;
  }

  // TODO: generalize to cleanup() once more use cases are available
  async deleteTestOrder(): Promise<void> {
    this.orderCollection.deleteOne({
      _id: MUUID.from(this.testOrder.id.value),
    });
  }

  static getRandomOrigin(): string {
    return getRandomElement(originCountriesAvailable);
  }

  static getRandomDestination(): string {
    return getRandomElement(destinationCountriesAvailable);
  }
}