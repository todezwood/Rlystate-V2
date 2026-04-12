import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { firebaseAuth } from '../lib/firebase';

export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      zipCode: user.zipCode,
      photoUrl: user.photoUrl,
      calendarConnected: !!user.googleCalendarAccessToken,
    });
  } catch (error) {
    console.error('[profile] getProfile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, phone, zipCode, photoUrl } = req.body;

    // Validate field lengths and formats
    if (firstName !== undefined && (typeof firstName !== 'string' || firstName.length > 64)) {
      res.status(400).json({ error: 'firstName must be a string of 64 characters or fewer' });
      return;
    }
    if (lastName !== undefined && (typeof lastName !== 'string' || lastName.length > 64)) {
      res.status(400).json({ error: 'lastName must be a string of 64 characters or fewer' });
      return;
    }
    if (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.length > 20)) {
      res.status(400).json({ error: 'phone must be a string of 20 characters or fewer' });
      return;
    }
    if (zipCode !== undefined && zipCode !== null) {
      if (typeof zipCode !== 'string' || !/^\d{5}(-\d{4})?$/.test(zipCode)) {
        res.status(400).json({ error: 'zipCode must be a valid 5-digit or ZIP+4 format' });
        return;
      }
    }

    // Build update object from only provided fields (ignore email)
    const data: Record<string, string | null> = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (phone !== undefined) data.phone = phone;
    if (zipCode !== undefined) data.zipCode = zipCode;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
    });

    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      zipCode: user.zipCode,
      photoUrl: user.photoUrl,
      calendarConnected: !!user.googleCalendarAccessToken,
    });
  } catch (error) {
    console.error('[profile] updateProfile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    // Block deletion if there are active negotiations
    const activeConversation = await prisma.conversation.findFirst({
      where: {
        status: 'active',
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
    });
    if (activeConversation) {
      res.status(400).json({
        error: 'You have an active negotiation in progress. Please complete or close it before deleting your account.',
      });
      return;
    }

    // Anonymize the user record (soft delete) inside a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          firstName: null,
          lastName: null,
          phone: null,
          zipCode: null,
          photoUrl: null,
          googleCalendarAccessToken: null,
          googleCalendarRefreshToken: null,
          email: `deleted-${userId}@deleted.rlystate`,
          name: 'Deleted User',
          deletedAt: new Date(),
        },
      }),
    ]);

    // Delete from Firebase Auth after DB is committed. Failure here is non-fatal:
    // the deletedAt check in the middleware prevents the account from being used.
    try {
      await firebaseAuth.deleteUser(userId);
    } catch (fbError) {
      console.error('[profile] Firebase deleteUser error (non-fatal):', fbError);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[profile] deleteAccount error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
