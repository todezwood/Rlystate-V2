-- Add coordination fields to Transaction
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "pickupScheduledAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "pickupTimezone" TEXT;
