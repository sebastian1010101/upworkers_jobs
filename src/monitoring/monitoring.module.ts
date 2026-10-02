import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

@Module({
  imports: [PrismaModule],
  controllers: [MonitoringController],
  providers: [
    MonitoringService,
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class MonitoringModule {}
