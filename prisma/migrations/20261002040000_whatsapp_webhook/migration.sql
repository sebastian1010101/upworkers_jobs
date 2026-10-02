-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'SAVED';

-- CreateEnum
CREATE TYPE "WhatsAppAction" AS ENUM ('PROPOSAL_REQUESTED', 'IGNORE', 'SAVE', 'SHOW_ANALYSIS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InboundMessageStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "WhatsAppInboundMessage" (
    "id" UUID NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "jobId" UUID,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "action" "WhatsAppAction" NOT NULL,
    "status" "InboundMessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppInboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppInboundMessage_externalMessageId_key" ON "WhatsAppInboundMessage"("externalMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppInboundMessage_status_receivedAt_idx" ON "WhatsAppInboundMessage"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "WhatsAppInboundMessage_jobId_action_idx" ON "WhatsAppInboundMessage"("jobId", "action");

-- AddForeignKey
ALTER TABLE "WhatsAppInboundMessage" ADD CONSTRAINT "WhatsAppInboundMessage_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
