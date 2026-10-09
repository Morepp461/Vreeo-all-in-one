ALTER TABLE "tickets"
ADD COLUMN "source_interaction_id" VARCHAR(32);

CREATE UNIQUE INDEX "tickets_source_interaction_id_key"
ON "tickets"("source_interaction_id");
