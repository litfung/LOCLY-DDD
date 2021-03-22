import * as supertest from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { isUUID } from 'class-validator';

import { AppModule } from '../../../../src/AppModule';
import { Customer } from '../../../../src/order/domain/entity/Customer';
import { OrderRepository } from '../../../../src/order/application/port/OrderRepository';
import { EntityId } from '../../../../src/common/domain/EntityId';
import { OrderStatus } from '../../../../src/order/domain/entity/Order';
import { CustomerRepository } from '../../../../src/order/application/port/CustomerRepository';
import {
  Address,
  AddressProps,
} from '../../../../src/order/domain/entity/Address';
import { Category } from '../../../../src/order/domain/entity/Item';
import { Country } from '../../../../src/order/domain/data/Country';
import {
  destinationCountriesAvailable,
  originCountriesAvailable,
} from '../../../../src/order/application/services/HostMatcherService';

describe('Create Order – POST /order/create', () => {
  let app: INestApplication;

  let customerRepository: CustomerRepository;
  let orderRepository: OrderRepository;

  let testOrderId: EntityId;
  let testCustomer: Customer;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    customerRepository = (await moduleRef.resolve(
      CustomerRepository,
    )) as CustomerRepository;

    orderRepository = (await moduleRef.resolve(
      OrderRepository,
    )) as OrderRepository;

    // Customer shouldn't be affected from test case to test case,
    // so we initialize it once, before all tests.
    testCustomer = new Customer({
      selectedAddress: new Address({
        country: destinationCountriesAvailable[1],
      }),
      orderIds: [],
    });

    await customerRepository.addCustomer(testCustomer);
  });

  // Customer shouldn't be affected from test case to test case,
  // so we destroy it once, after all tests.
  afterAll(() =>
    Promise.all([
      //customerRepository.deleteCustomer(testCustomer.id),
      //orderRepository.deleteOrder(testOrderId),
    ]),
  );

  it('returns an Order object on proper Order Request format and existing customerId', async () => {
    const response: supertest.Response = await supertest(app.getHttpServer())
      .post('/order/create')
      .send({
        customerId: testCustomer.id.value,
        originCountry: originCountriesAvailable[0],
        // TODO: Item fixture
        items: [
          {
            title: 'Laptop',
            storeName: 'Amazon',
            width: 100,
            height: 100,
            length: 100,
            weight: 10,
            category: Category.Electronics,
          },
        ],
      });

    expect(response.status).toBe(201);

    // TODO: strong typing
    const {
      id,
      customerId,
      status,
      destination,
    }: {
      id: string;
      customerId: string;
      status: OrderStatus;
      destination: AddressProps;
    } = response.body;

    testOrderId = new EntityId(id);

    const updatedTestCustomer: Customer = await customerRepository.findCustomer(
      testCustomer.id,
    );

    expect(updatedTestCustomer.orderIds.map(({ value }) => value)).toContain(
      testOrderId.value,
    );
    expect(isUUID(id)).toBe(true);
    expect(customerId).toEqual(updatedTestCustomer.id.value);
    expect(status).toBe(OrderStatus.Drafted);
    expect(destination.country).toBe(testCustomer.selectedAddress.country);
  });
});
