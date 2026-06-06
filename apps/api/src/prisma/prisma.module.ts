import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class.
export class PrismaModule {}
