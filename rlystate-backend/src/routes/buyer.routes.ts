import { Router } from 'express';
import { searchListings, startAutoNegotiate, getClosedDeals } from '../controllers/buyer.controller';
import { getProfile, updateProfile, deleteAccount } from '../controllers/profile.controller';

const router = Router();

router.post('/search', searchListings);
router.post('/auto-negotiate', startAutoNegotiate);

export default router;

export const profileRouter = Router();
profileRouter.get('/', getProfile);
profileRouter.patch('/', updateProfile);
profileRouter.delete('/', deleteAccount);
profileRouter.get('/deals', getClosedDeals);
