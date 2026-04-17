import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:5173', credentials: true });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('KVKK Breach Monitor API')
    .setDescription('Endpoints for posts, scraper, email deliveries, settings, and SSE.')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const prisma = app.get(PrismaService);
  prisma.enableShutdownHooks(app);
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
}

bootstrap();
