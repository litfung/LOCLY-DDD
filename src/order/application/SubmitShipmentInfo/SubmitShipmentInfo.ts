import { HttpStatus, Injectable } from '@nestjs/common';
import { IOrderRepository } from '../../persistence/IOrderRepository';
import { InjectClient } from 'nest-mongodb';
import { ClientSession, MongoClient } from 'mongodb';
import { withTransaction } from '../../../common/application';
import {
  SubmitShipmentInfoPayload,
  ISubmitShipmentInfo,
} from './ISubmitShipmentInfo';
import { Order, OrderStatus } from '../../entity/Order';
import { throwCustomException } from '../../../common/error-handling';
import { Item } from '../../entity/Item';
import { UUID } from '../../../common/domain';

@Injectable()
export class SubmitShipmentInfo implements ISubmitShipmentInfo {
  constructor(
    private readonly orderRepository: IOrderRepository,
    @InjectClient() private readonly mongoClient: MongoClient,
  ) {}

  async execute(
    finalizeOrderRequest: SubmitShipmentInfoPayload,
    mongoTransactionSession?: ClientSession,
  ): Promise<void> {
    await withTransaction(
      (sessionWithTransaction: ClientSession) =>
        this.finalizeOrder(finalizeOrderRequest, sessionWithTransaction),
      this.mongoClient,
      mongoTransactionSession,
    );
  }

  private async finalizeOrder(
    {
      orderId,
      hostId,
      totalWeight,
      shipmentCost: finalShipmentCost,
      calculatorResultUrl,
    }: SubmitShipmentInfoPayload,
    mongoTransactionSession: ClientSession,
  ): Promise<void> {
    const notFinalizedItems: Item[] = await this.getUnfinalizedItems(
      orderId,
      hostId,
    );

    const notFinalizedItemIds: UUID[] = notFinalizedItems.map(({ id }) => id);

    if (notFinalizedItems.length) {
      throwCustomException(
        "Can't finalize order until all items have weights and photos",
        { orderId, notFinalizedItemIds },
        HttpStatus.FORBIDDEN,
      )();
    }

    await this.orderRepository.setProperties(
      // status and hostId are already checked in findOrder()
      { orderId },
      {
        totalWeight,
        finalShipmentCost,
        status: OrderStatus.Finalized,
        ...(calculatorResultUrl ? { calculatorResultUrl } : {}),
      },
      mongoTransactionSession,
    );
  }

  private async getUnfinalizedItems(
    orderId: UUID,
    hostId: UUID,
  ): Promise<Item[]> {
    // TODO(?): Replace this check with a mongo query http://www.askasya.com/post/matchallarrayelements/
    const order: Order = await this.orderRepository.findOrder({
      orderId,
      status: OrderStatus.Confirmed,
      hostId,
    });

    const notFinalizedItems: Item[] = order.items.filter(
      ({ receivedDate, photos }) => !(receivedDate && photos.length),
    );

    return notFinalizedItems;
  }
}
