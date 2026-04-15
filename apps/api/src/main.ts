import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:5173', credentials: true });
  app.setGlobalPrefix('api');
  const prisma = app.get(PrismaService);
  prisma.enableShutdownHooks(app);
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
}

bootstrap();
