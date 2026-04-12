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
