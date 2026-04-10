import { Router } from 'express';
import { negotiate, getHistory, getMyConversations, getConversationInfo, declineDeal } from '../controllers/chat.controller';

const router = Router();

// Buyer's conversations (must be before :listingId routes)
router.get('/mine', getMyConversations);

// Fire off a message into the Agent pipeline
router.post('/:listingId/negotiate', negotiate);

// Fetch UI timeline
router.get('/:listingId/history', getHistory);

// Fetch conversation metadata (autonomyMode, status)
router.get('/:listingId/info', getConversationInfo);

// Buyer declines a completed deal — resets listing to ACTIVE
router.post('/:listingId/decline-deal', declineDeal);

export default router;
