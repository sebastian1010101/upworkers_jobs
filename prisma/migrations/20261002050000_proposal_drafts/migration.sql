-- CreateTable
CREATE TABLE "ProposalDraft" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProposalDraft_jobId_key" ON "ProposalDraft"("jobId");

-- AddForeignKey
ALTER TABLE "ProposalDraft" ADD CONSTRAINT "ProposalDraft_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
