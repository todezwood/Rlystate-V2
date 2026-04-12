import { Router } from 'express';
import { connectCalendar, disconnectCalendar } from '../controllers/auth.controller';

const router = Router();

router.post('/connect-calendar', connectCalendar);
router.delete('/calendar', disconnectCalendar);

export default router;
