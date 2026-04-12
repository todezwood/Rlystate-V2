import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const connectCalendar = async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken || typeof accessToken !== 'string') {
      res.status(400).json({ error: 'accessToken required' });
      return;
    }
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { googleCalendarAccessToken: accessToken },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[auth] connectCalendar error:', error);
    res.status(500).json({ error: 'Failed to store calendar token' });
  }
};

export const disconnectCalendar = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    // Fire-and-forget token revocation — do not fail the request if this errors
    if (user?.googleCalendarAccessToken) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${user.googleCalendarAccessToken}`, {
        method: 'POST',
      }).catch(err => console.error('[auth] token revocation error (non-fatal):', err));
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        googleCalendarAccessToken: null,
        googleCalendarRefreshToken: null,
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[auth] disconnectCalendar error:', error);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
};
