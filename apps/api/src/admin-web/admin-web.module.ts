import { Module } from '@nestjs/common';
import { AdminWebController } from './admin-web.controller';

@Module({
  controllers: [AdminWebController]
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class.
export class AdminWebModule {}
