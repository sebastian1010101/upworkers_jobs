-- CreateTable
CREATE TABLE "JobAnalysis" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "score" DECIMAL(3,1) NOT NULL,
    "technicalScore" DECIMAL(3,1) NOT NULL,
    "experienceScore" DECIMAL(3,1) NOT NULL,
    "portfolioScore" DECIMAL(3,1) NOT NULL,
    "communicationScore" DECIMAL(3,1) NOT NULL,
    "competitionScore" DECIMAL(3,1) NOT NULL,
    "strengths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "recommendation" TEXT NOT NULL,
    "shouldNotify" BOOLEAN NOT NULL,
    "model" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobAnalysis_jobId_key" ON "JobAnalysis"("jobId");

-- AddForeignKey
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
