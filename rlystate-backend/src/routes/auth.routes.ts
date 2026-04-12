import { Router } from 'express';
import { connectCalendar } from '../controllers/auth.controller';

const router = Router();

router.post('/connect-calendar', connectCalendar);

export default router;
