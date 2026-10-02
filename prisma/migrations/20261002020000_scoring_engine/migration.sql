-- AlterTable: preserve phase 7 scores as the original LLM components.
ALTER TABLE "JobAnalysis"
ADD COLUMN "llmScore" DECIMAL(3,1),
ADD COLUMN "ruleScore" DECIMAL(3,1),
ADD COLUMN "clientScore" DECIMAL(3,1),
ADD COLUMN "llmCompetitionScore" DECIMAL(3,1),
ADD COLUMN "scoredAt" TIMESTAMP(3);

UPDATE "JobAnalysis"
SET "llmScore" = "score",
    "ruleScore" = 5.0,
    "clientScore" = 5.0,
    "llmCompetitionScore" = "competitionScore",
    "scoredAt" = "analyzedAt";

ALTER TABLE "JobAnalysis"
ALTER COLUMN "llmScore" SET NOT NULL,
ALTER COLUMN "ruleScore" SET NOT NULL,
ALTER COLUMN "clientScore" SET NOT NULL,
ALTER COLUMN "llmCompetitionScore" SET NOT NULL,
ALTER COLUMN "scoredAt" SET NOT NULL,
ALTER COLUMN "scoredAt" SET DEFAULT CURRENT_TIMESTAMP;
