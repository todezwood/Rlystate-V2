/**
 * One-time backfill: fix transactions created with status "COMPLETED" (a bug
 * in simulateDeposit that has since been corrected).
 *
 * Logic:
 *   - Rows with status "COMPLETED" and no calendarEventId had a deposit held
 *     but pickup was never scheduled. Correct status: "DEPOSIT_HELD".
 *   - Rows with status "COMPLETED" and a calendarEventId had pickup scheduled
 *     successfully. Correct status: "PICKUP_SCHEDULED".
 *
 * Run once against prod after deploying the fix:
 *   npx ts-node scripts/backfill-transaction-status.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const depositHeld = await prisma.transaction.updateMany({
    where: { status: 'COMPLETED', calendarEventId: null },
    data: { status: 'DEPOSIT_HELD' },
  });
  console.log(`Updated ${depositHeld.count} rows to DEPOSIT_HELD`);

  const pickupScheduled = await prisma.transaction.updateMany({
    where: { status: 'COMPLETED', NOT: { calendarEventId: null } },
    data: { status: 'PICKUP_SCHEDULED' },
  });
  console.log(`Updated ${pickupScheduled.count} rows to PICKUP_SCHEDULED`);

  const remaining = await prisma.transaction.count({ where: { status: 'COMPLETED' } });
  if (remaining > 0) {
    console.warn(`WARNING: ${remaining} rows still have status "COMPLETED" after backfill.`);
  } else {
    console.log('Backfill complete. No remaining COMPLETED rows.');
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
