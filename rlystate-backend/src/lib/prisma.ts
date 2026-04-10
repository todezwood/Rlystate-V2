import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

prisma.$connect()
  .then(() => console.log('[prisma] startup $connect() OK'))
  .catch((e: unknown) => {
    const err = e as { name?: string; message?: string; code?: string; clientVersion?: string; meta?: unknown; errorCode?: string };
    console.error('[prisma] startup $connect() FAILED name:', err?.name);
    console.error('[prisma] startup $connect() FAILED message:', err?.message);
    console.error('[prisma] startup $connect() FAILED fields:', JSON.stringify({
      code: err?.code,
      clientVersion: err?.clientVersion,
      meta: err?.meta,
      errorCode: err?.errorCode,
    }));
    console.error('[prisma] DATABASE_URL length:', process.env.DATABASE_URL?.length ?? 'UNSET');
  });

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
