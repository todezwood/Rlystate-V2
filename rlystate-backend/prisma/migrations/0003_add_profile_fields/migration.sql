-- Migration: add profile fields to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "firstName" TEXT,
  ADD COLUMN IF NOT EXISTS "lastName"  TEXT,
  ADD COLUMN IF NOT EXISTS "phone"     TEXT,
  ADD COLUMN IF NOT EXISTS "zipCode"   TEXT,
  ADD COLUMN IF NOT EXISTS "photoUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Backfill firstName and lastName from existing name field
UPDATE "User"
SET
  "firstName" = SPLIT_PART(COALESCE("name", ''), ' ', 1),
  "lastName"  = NULLIF(TRIM(SUBSTRING(COALESCE("name", '') FROM POSITION(' ' IN COALESCE("name", '')))), '')
WHERE "firstName" IS NULL AND "name" IS NOT NULL AND TRIM(COALESCE("name", '')) != '';
