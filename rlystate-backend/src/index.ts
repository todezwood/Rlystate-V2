import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { prisma } from './lib/prisma';
import { authMiddleware } from './middleware/auth.middleware';
import listingRoutes from './routes/listing.routes';
import chatRoutes from './routes/chat.routes';
import transactionRoutes from './routes/transaction.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Mock login: generates a user identity for local multi-user testing
app.post('/api/auth/mock-login', async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || typeof displayName !== 'string') {
      res.status(400).json({ error: 'displayName is required' });
      return;
    }

    const userId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        email: `${displayName.toLowerCase().replace(/\s+/g, '.')}+${userId.slice(0, 8)}@mock.rlystate.test`,
        name: displayName,
      },
    });

    res.json({ userId, displayName });
  } catch (error) {
    console.error('Mock login error:', error);
    res.status(500).json({ error: 'Failed to create mock session' });
  }
});

// Serve local uploads directory (dev only — production uses GCS CDN URLs)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Protected routes
app.use('/api/listings', authMiddleware, listingRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/transactions', authMiddleware, transactionRoutes);

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
