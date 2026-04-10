import { Router } from 'express';
import { searchListings, startAutoNegotiate, getClosedDeals } from '../controllers/buyer.controller';

const router = Router();

router.post('/search', searchListings);
router.post('/auto-negotiate', startAutoNegotiate);

export default router;

export const profileRouter = Router();
profileRouter.get('/deals', getClosedDeals);
