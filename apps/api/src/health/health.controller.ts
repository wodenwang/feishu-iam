import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type HealthResponse = {
  status: 'ok';
  service: 'feishu-iam-api';
};

type ReadyResponse = {
  status: 'ready' | 'not_ready';
  checks: {
    database: 'ok' | 'error';
  };
};

@Controller()
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('health')
  health(): HealthResponse {
    return {
      status: 'ok',
      service: 'feishu-iam-api'
    };
  }

  @Get('ready')
  async ready(): Promise<ReadyResponse> {
    try {
      await this.prisma.isReady();
      return {
        status: 'ready',
        checks: {
          database: 'ok'
        }
      };
    } catch {
      return {
        status: 'not_ready',
        checks: {
          database: 'error'
        }
      };
    }
  }
}
