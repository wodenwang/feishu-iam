import { Module } from '@nestjs/common';
import { OauthAcceptanceController } from './oauth-acceptance.controller';

@Module({
  controllers: [OauthAcceptanceController]
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class.
export class AcceptanceModule {}
