import { google } from 'googleapis';
import { prisma } from '../lib/prisma';

interface PickupSlot {
  start: string;
  end: string;
}

type SlotsResult =
  | PickupSlot[]
  | { noCalendar: true }
  | { error: 'calendar_token_expired' }
  | { error: string };

type BookResult =
  | { success: true; htmlLink: string | null | undefined; calendarEventId: string | null | undefined }
  | { success: true; alreadyScheduled: true; calendarEventId: string }
  | { error: 'calendar_token_expired' }
  | { error: string };

function isGoogleAuthError(err: unknown): boolean {
  const e = err as { response?: { status?: number }; code?: number; status?: number };
  return e?.response?.status === 401 || e?.code === 401 || e?.status === 401;
}

function buildOAuthClient(accessToken: string, refreshToken: string | null | undefined, userId: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment');
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  });
  // Persist refreshed access tokens so the next call doesn't need another round-trip to Google.
  auth.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.user.update({
        where: { id: userId },
        data: { googleCalendarAccessToken: tokens.access_token },
      }).catch(err => console.error('[coordination] failed to persist refreshed access token:', err));
    }
  });
  return auth;
}

// Parse "MM/DD/YYYY, HH:MM:SS" produced by Intl.DateTimeFormat to a Date
function parseIntlDate(str: string): Date {
  const [datePart, timePart] = str.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
}

// Return how many ms the given timezone is ahead of UTC at the given UTC instant.
function getTimezoneOffsetMs(utcDate: Date, timezone: string): number {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: tz,
    }).format(utcDate);

  return parseIntlDate(fmt(timezone)).getTime() - parseIntlDate(fmt('UTC')).getTime();
}

// Convert a YYYY-MM-DD string + local hour to a UTC Date in the given timezone.
function zonedTimeToUtc(dateStr: string, hourLocal: number, timezone: string): Date {
  // Reference point: UTC midnight of the date
  const utcMidnight = new Date(`${dateStr}T00:00:00Z`);
  const offsetMs = getTimezoneOffsetMs(utcMidnight, timezone);
  // Local time in ms since epoch (treating dateStr as local, not UTC)
  const localMs = utcMidnight.getTime() + hourLocal * 60 * 60 * 1000;
  return new Date(localMs - offsetMs);
}

// Generate candidate 2-hour pickup slots at 10am, 1pm, 4pm on weekdays
// in the buyer's timezone, for the next 14 days.
function generateCandidates(buyerTimezone: string): PickupSlot[] {
  const candidates: PickupSlot[] = [];
  const now = new Date();
  const startHours = [10, 13, 16];

  for (let dayOffset = 1; dayOffset <= 14 && candidates.length < 15; dayOffset++) {
    const candidateUtc = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);

    // Get the YYYY-MM-DD in the buyer's timezone
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      timeZone: buyerTimezone,
    }).format(candidateUtc);

    // Skip weekends in the buyer's timezone
    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'short', timeZone: buyerTimezone,
    }).format(candidateUtc);
    if (weekday === 'Sat' || weekday === 'Sun') continue;

    for (const hour of startHours) {
      const slotStart = zonedTimeToUtc(dateStr, hour, buyerTimezone);
      const slotEnd = new Date(slotStart.getTime() + 2 * 60 * 60 * 1000);
      candidates.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
    }
  }

  return candidates;
}

function slotsOverlap(
  candStart: Date,
  candEnd: Date,
  busyStart: string,
  busyEnd: string
): boolean {
  const bStart = new Date(busyStart).getTime();
  const bEnd = new Date(busyEnd).getTime();
  return candStart.getTime() < bEnd && candEnd.getTime() > bStart;
}

export async function getPickupSlots(
  listingId: string,
  buyerTimezone: string
): Promise<SlotsResult> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      seller: {
        select: {
          id: true,
          googleCalendarAccessToken: true,
          googleCalendarRefreshToken: true,
          email: true,
        },
      },
    },
  });

  if (!listing) return { error: 'Listing not found' };
  if (!listing.seller.googleCalendarAccessToken || !listing.seller.googleCalendarRefreshToken) return { noCalendar: true };

  try {
    const auth = buildOAuthClient(
      listing.seller.googleCalendarAccessToken,
      listing.seller.googleCalendarRefreshToken,
      listing.seller.id
    );
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const busyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: windowEnd.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busyBlocks = busyResponse.data.calendars?.primary?.busy ?? [];
    const candidates = generateCandidates(buyerTimezone);
    const available: PickupSlot[] = [];

    for (const slot of candidates) {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);
      const conflict = busyBlocks.some(
        b => b.start && b.end && slotsOverlap(slotStart, slotEnd, b.start, b.end)
      );
      if (!conflict) {
        available.push(slot);
        if (available.length === 3) break;
      }
    }

    return available;
  } catch (err) {
    console.error('[coordination] getPickupSlots error:', err);
    if (isGoogleAuthError(err)) return { error: 'calendar_token_expired' };
    throw err;
  }
}

export async function bookPickupSlot(
  listingId: string,
  buyerId: string,
  start: string,
  end: string
): Promise<BookResult> {
  // Idempotency: if a calendar event was already created, return it without creating another
  const existingTx = await prisma.transaction.findFirst({
    where: { listingId, buyerId },
  });
  if (existingTx?.calendarEventId) {
    return {
      success: true,
      alreadyScheduled: true,
      calendarEventId: existingTx.calendarEventId,
    };
  }
  if (!existingTx) return { error: 'Transaction not found' };

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      seller: {
        select: {
          id: true,
          googleCalendarAccessToken: true,
          googleCalendarRefreshToken: true,
          email: true,
        },
      },
    },
  });
  if (!listing) return { error: 'Listing not found' };
  if (!listing.seller.googleCalendarAccessToken || !listing.seller.googleCalendarRefreshToken) return { error: 'no_calendar' };

  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    select: { email: true },
  });
  if (!buyer) return { error: 'Buyer not found' };

  try {
    const auth = buildOAuthClient(
      listing.seller.googleCalendarAccessToken,
      listing.seller.googleCalendarRefreshToken,
      listing.seller.id
    );
    const calendar = google.calendar({ version: 'v3', auth });

    const event = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: 'all',
      requestBody: {
        summary: `Rlystate pickup: ${listing.title}`,
        description: `Buyer pickup for your Rlystate listing.\n\nItem: ${listing.title}\nCondition: ${listing.condition}\nAgreed price: $${listing.agreedPrice ?? existingTx.amount}`,
        start: { dateTime: start },
        end: { dateTime: end },
        attendees: [
          { email: listing.seller.email },
          { email: buyer.email },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      },
    });

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: existingTx.id },
        data: {
          status: 'PICKUP_SCHEDULED',
          pickupScheduledAt: new Date(start),
          calendarEventId: event.data.id,
        },
      }),
      prisma.listing.update({
        where: { id: listingId },
        data: { status: 'SOLD' },
      }),
    ]);

    return {
      success: true,
      htmlLink: event.data.htmlLink,
      calendarEventId: event.data.id,
    };
  } catch (err) {
    console.error('[coordination] bookPickupSlot error:', err);
    if (isGoogleAuthError(err)) return { error: 'calendar_token_expired' };
    throw err;
  }
}
