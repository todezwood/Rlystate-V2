import { Router } from 'express';
import { getSlots, confirmSlot } from '../controllers/coordination.controller';

const router = Router();

router.get('/:listingId/slots', getSlots);
router.post('/:listingId/confirm', confirmSlot);

export default router;
