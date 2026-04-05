import { Router } from 'express';
import { evaluateAndDraft, publishListing, getListings, getMyListings, getUploadUrl, uploadDirect } from '../controllers/listing.controller';

const router = Router();

// Get Signed Upload URL (production GCS flow)
router.post('/upload-url', getUploadUrl);

// Direct upload (local dev flow — bypasses GCS credential requirement)
router.post('/upload-direct', uploadDirect);

// Draft a listing via Claude Vision
router.post('/evaluate', evaluateAndDraft);

// Publish the listing to the Cloud SQL Database
router.post('/publish', publishListing);

// Fetch current user's own listings
router.get('/me', getMyListings);

// Fetch all active listings for the Buyer Feed (excludes current user's)
router.get('/', getListings);

export default router;
