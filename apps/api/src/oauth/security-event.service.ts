import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { OauthResult } from './oauth.types';

export type SecurityEventInput = {
  eventType: string;
  applicationId?: string | null;
  clientId?: string | null;
  feishuUserId?: string | null;
  result: OauthResult;
  reasonCode?: string | null;
  summary: string;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

type SecurityEventClient = Pick<Prisma.TransactionClient, 'securityEvent'>;

@Injectable()
export class SecurityEventService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: SecurityEventInput, client: SecurityEventClient = this.prisma): Promise<void> {
    await client.securityEvent.create({
      data: {
        id: randomUUID(),
        eventType: input.eventType,
        applicationId: input.applicationId ?? null,
        clientId: input.clientId ?? null,
        feishuUserId: input.feishuUserId ?? null,
        result: input.result,
        reasonCode: input.reasonCode ?? null,
        summary: input.summary,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null
      }
    });
  }
}
