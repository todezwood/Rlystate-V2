import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { firebaseAuth } from '../lib/firebase';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const idToken = authHeader.slice(7);

  try {
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const firebaseUid = decoded.uid;

    // Upsert: create user row on first authenticated request, find on subsequent ones.
    // Use select to avoid querying columns that may not exist pre-migration.
    let user = await prisma.user.findUnique({
      where: { id: firebaseUid },
      select: { id: true, name: true },
    });
    if (!user) {
      const nameParts = (decoded.name || '').trim().split(' ');
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(' ') || null;
      try {
        user = await prisma.user.create({
          data: {
            id: firebaseUid,
            email: decoded.email || `${firebaseUid}@firebase.rlystate.app`,
            name: decoded.name || decoded.email?.split('@')[0] || 'User',
            firstName,
            lastName,
            photoUrl: (decoded as { picture?: string }).picture || null,
          },
          select: { id: true, name: true },
        });
      } catch {
        // Migration not yet applied — create without new profile fields
        user = await prisma.user.create({
          data: {
            id: firebaseUid,
            email: decoded.email || `${firebaseUid}@firebase.rlystate.app`,
            name: decoded.name || decoded.email?.split('@')[0] || 'User',
          },
          select: { id: true, name: true },
        });
      }
    }
    // deletedAt check is not needed here: deleted accounts have their Firebase
    // record removed, so verifyIdToken fails before this point.

    req.user = { id: user.id, displayName: user.name || undefined };
    next();
  } catch (error) {
    const e = error as { name?: string; message?: string; code?: string; clientVersion?: string; meta?: unknown };
    console.error('[auth] error name:', e?.name);
    console.error('[auth] error message:', e?.message);
    console.error('[auth] error fields:', JSON.stringify({ code: e?.code, clientVersion: e?.clientVersion, meta: e?.meta }));
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
