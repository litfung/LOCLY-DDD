import { Injectable } from '@nestjs/common';
import { Binary, ClientSession, Collection } from 'mongodb';
import { InjectCollection } from 'nest-mongodb';
import { UUID } from '../../../../common/domain/UUID';
import { Code } from '../../../../common/error-handling/Code';
import { Exception } from '../../../../common/error-handling/Exception';
import { uuidToMuuid } from '../../../../common/utils';

// TODO: Remove MatchRepository, record the match in Stripe metadata
// ^ NO: https://stackoverflow.com/questions/55744094/stripe-checkout-wont-accept-metadata
// Doesn't work properly
// https://support.stripe.com/questions/using-metadata-with-checkout-sessions

import { Match, MatchRecorder } from '../../../application/port/MatchRecorder';
import {
  MatchMongoDocument,
  matchToMongoDocument,
  mongoDocumentToMatch,
} from './MatchMongoMapper';

@Injectable()
export class MatchMongoRecorderAdapter implements MatchRecorder {
  constructor(
    @InjectCollection('matches')
    private readonly matchCollection: Collection<MatchMongoDocument>,
  ) {}

  async recordMatch(
    orderId: UUID,
    hostId: UUID,
    session?: ClientSession,
  ): Promise<UUID> {
    const matchId = orderId;

    await this.matchCollection.insertOne(
      matchToMongoDocument({ orderId, hostId }),
      { session },
    );

    return matchId;
  }

  async retrieveAndDeleteMatch(
    matchId: UUID,
    session?: ClientSession,
  ): Promise<Match> {
    const matchMongoBinaryId: Binary = uuidToMuuid(matchId);
    const matchDocument: MatchMongoDocument = await this.matchCollection.findOne(
      { _id: matchMongoBinaryId },
      { session },
    );

    await this.matchCollection.deleteOne(
      { _id: matchMongoBinaryId },
      { session },
    );

    return mongoDocumentToMatch(matchDocument);
  }

  async findMatch(
    orderId: UUID,
    hostId: UUID,
    session?: ClientSession,
  ): Promise<Match> {
    const orderMongoBinaryId: Binary = uuidToMuuid(orderId);
    const hostMongoBinaryId: Binary = uuidToMuuid(hostId);

    const matchDocument: MatchMongoDocument = await this.matchCollection.findOne(
      { _id: orderMongoBinaryId, hostId: hostMongoBinaryId },
      { session },
    );

    if (!matchDocument) {
      throw new Exception(
        Code.ENTITY_NOT_FOUND_ERROR,
        `Match (orderId: ${orderId}, hostId: ${hostId}) not found`,
        { orderId, hostId },
      );
    }

    return mongoDocumentToMatch(matchDocument);
  }
}
