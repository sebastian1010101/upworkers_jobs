-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('MANUAL', 'UPWORK');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "source" "JobSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "url" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Job_source_expiresAt_idx" ON "Job"("source", "expiresAt");
