import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { authMiddleware } from './middleware/auth.middleware';
import listingRoutes from './routes/listing.routes';
import chatRoutes from './routes/chat.routes';
import transactionRoutes from './routes/transaction.routes';
import buyerRoutes, { profileRouter } from './routes/buyer.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Serve local uploads directory (dev only — production uses GCS CDN URLs)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Protected routes
app.use('/api/listings', authMiddleware, listingRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/transactions', authMiddleware, transactionRoutes);
app.use('/api/buyer', authMiddleware, buyerRoutes);
app.use('/api/profile', authMiddleware, profileRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rlystate-backend' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend service listening on port ${PORT}`);
});
