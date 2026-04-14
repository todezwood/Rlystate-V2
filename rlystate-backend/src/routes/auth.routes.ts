import { Router } from 'express';
import { connectCalendar, initiateCalendarConnect, disconnectCalendar } from '../controllers/auth.controller';

const router = Router();

// Legacy endpoint — now returns 410
router.post('/connect-calendar', connectCalendar);
// Initiate server-side Google OAuth flow for calendar access
router.get('/calendar/connect', initiateCalendarConnect);
router.delete('/calendar', disconnectCalendar);

export default router;
