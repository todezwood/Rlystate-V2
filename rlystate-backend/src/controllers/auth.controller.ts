import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { google } from 'googleapis';
import { prisma } from '../lib/prisma';

// Legacy endpoint kept for graceful 400 response if old clients still call it
export const connectCalendar = async (req: Request, res: Response) => {
  res.status(410).json({ error: 'This endpoint is no longer supported. Use GET /api/auth/calendar/connect instead.' });
};

export const initiateCalendarConnect = async (req: Request, res: Response) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
    const stateSecret = process.env.CALENDAR_OAUTH_STATE_SECRET;

    if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
      res.status(500).json({ error: 'Calendar OAuth is not configured on this server.' });
      return;
    }

    const userId = req.user!.id;
    const timestamp = Date.now().toString();
    const payload = `${userId}:${timestamp}`;
    const sig = createHmac('sha256', stateSecret).update(payload).digest('hex');
    const state = `${payload}:${sig}`;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.freebusy',
      ],
      state,
    });

    res.json({ url });
  } catch (error) {
    console.error('[auth] initiateCalendarConnect error:', error);
    res.status(500).json({ error: 'Failed to generate calendar connect URL' });
  }
};

export const handleCalendarCallback = async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError) {
      console.warn('[auth] calendar callback OAuth error:', oauthError);
      res.redirect(`${frontendUrl}/profile?calendar=error`);
      return;
    }

    if (!code || !state) {
      res.status(400).send('Missing code or state parameter.');
      return;
    }

    const stateSecret = process.env.CALENDAR_OAUTH_STATE_SECRET;
    if (!stateSecret) {
      res.status(500).send('Server misconfiguration.');
      return;
    }

    // Verify state: format is `userId:timestamp:sig`
    const parts = state.split(':');
    if (parts.length !== 3) {
      res.status(400).send('Invalid state parameter.');
      return;
    }
    const [userId, timestamp, receivedSig] = parts;
    const payload = `${userId}:${timestamp}`;
    const expectedSig = createHmac('sha256', stateSecret).update(payload).digest('hex');

    const sigBuffer = Buffer.from(receivedSig, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      res.status(400).send('Invalid state signature.');
      return;
    }

    const ageMs = Date.now() - parseInt(timestamp, 10);
    if (ageMs > 10 * 60 * 1000) {
      res.status(400).send('OAuth state expired. Please try connecting your calendar again.');
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI!;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('[auth] calendar callback: missing tokens from Google', tokens);
      res.redirect(`${frontendUrl}/profile?calendar=error`);
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleCalendarAccessToken: tokens.access_token,
        googleCalendarRefreshToken: tokens.refresh_token,
      },
    });

    res.redirect(`${frontendUrl}/profile?calendar=connected`);
  } catch (error) {
    console.error('[auth] handleCalendarCallback error:', error);
    res.redirect(`${frontendUrl}/profile?calendar=error`);
  }
};

export const disconnectCalendar = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    // Revoke the refresh token (preferred) to fully remove app access from Google.
    // Falling back to the access token if no refresh token is stored.
    const tokenToRevoke = user?.googleCalendarRefreshToken ?? user?.googleCalendarAccessToken;
    if (tokenToRevoke) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${tokenToRevoke}`, {
        method: 'POST',
      }).catch(err => console.error('[auth] token revocation error (non-fatal):', err));
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        googleCalendarAccessToken: null,
        googleCalendarRefreshToken: null,
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[auth] disconnectCalendar error:', error);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
};
