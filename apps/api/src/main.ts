import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// CONTRACT:
// Bootstrap the NestJS application.
// Logic:
//   1. Create NestJS app from AppModule
//   2. Enable CORS for web frontend origin
//   3. Set global prefix '/api'
//   4. Enable shutdown hooks for Prisma graceful disconnect
//   5. Listen on PORT env var (default 3000)
async function bootstrap() {
  throw new Error('not implemented');
}

bootstrap();
