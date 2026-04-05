import { Router } from 'express';
import { simulateDeposit, getTransactionByListing } from '../controllers/transaction.controller';

const router = Router();

router.post('/simulate', simulateDeposit);
router.get('/:listingId', getTransactionByListing);

export default router;
