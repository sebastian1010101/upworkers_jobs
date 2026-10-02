import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { HealthController } from './health/health.controller';
import { JobModule } from './jobs/job.module';
import { PrismaModule } from './prisma/prisma.module';
import { UpworkModule } from './upwork/upwork.module';
import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProposalModule } from './proposals/proposal.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    PrismaModule,
    JobModule,
    AiModule,
    ProposalModule,
    NotificationsModule,
    MonitoringModule,
    UpworkModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
