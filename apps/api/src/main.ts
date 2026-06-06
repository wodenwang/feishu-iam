import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getAdminWebDistDir } from './admin-web/admin-web.controller';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(getAdminWebDistDir());
  app.enableCors({
    origin: process.env.ADMIN_WEB_BASE_URL ?? 'http://localhost:5173',
    credentials: true
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
