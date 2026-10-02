-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('FIXED', 'HOURLY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('NEW', 'IGNORED');

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "budgetType" "BudgetType" NOT NULL DEFAULT 'UNKNOWN',
    "budgetMin" DECIMAL(12,2),
    "budgetMax" DECIMAL(12,2),
    "hourlyMin" DECIMAL(12,2),
    "hourlyMax" DECIMAL(12,2),
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientCountry" TEXT,
    "clientRating" DECIMAL(3,2),
    "clientTotalSpent" DECIMAL(14,2),
    "proposalCount" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawData" JSONB NOT NULL DEFAULT '{}',
    "status" "JobStatus" NOT NULL DEFAULT 'NEW',

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_externalId_key" ON "Job"("externalId");

-- CreateIndex
CREATE INDEX "Job_discoveredAt_idx" ON "Job"("discoveredAt");
