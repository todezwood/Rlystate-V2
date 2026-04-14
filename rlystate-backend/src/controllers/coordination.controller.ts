import { Request, Response } from 'express';
import { getPickupSlots, bookPickupSlot } from '../services/coordination.service';

export const getSlots = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const timezone = (req.query.timezone as string) || 'America/New_York';
    const result = await getPickupSlots(listingId, timezone);

    if (!Array.isArray(result)) {
      if ('noCalendar' in result) {
        res.status(404).json(result);
        return;
      }
      if ('error' in result && result.error === 'calendar_token_expired') {
        res.status(503).json(result);
        return;
      }
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('[coordination] getSlots error:', error);
    res.status(500).json({ error: 'Failed to fetch pickup slots' });
  }
};

export const confirmSlot = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const { start, end } = req.body;
    if (!start || !end) {
      res.status(400).json({ error: 'start and end are required' });
      return;
    }
    const buyerId = req.user!.id;
    const result = await bookPickupSlot(listingId, buyerId, start, end);
    res.json(result);
  } catch (error) {
    console.error('[coordination] confirmSlot error:', error);
    res.status(500).json({ error: 'Failed to schedule pickup' });
  }
};
