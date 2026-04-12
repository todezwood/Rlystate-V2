import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface ProfileData {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  zipCode: string | null;
  photoUrl: string | null;
  calendarConnected: boolean;
}

interface DealItem {
  listingId: string;
  role: 'bought' | 'sold';
  title: string;
  imageUrl: string;
  finalPrice: number;
  date: string;
}

export const ProfilePage = () => {
  const { displayName, photoURL, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [deals, setDeals] = useState<DealItem[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);

  const [calendarBusy, setCalendarBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchProfile = useCallback(() => {
    setProfileLoading(true);
    api('/api/profile')
      .then(res => res.json())
      .then((data: ProfileData) => {
        setProfile(data);
        setProfileLoading(false);
      })
      .catch(() => setProfileLoading(false));
  }, []);

  useEffect(() => {
    fetchProfile();
    api('/api/profile/deals')
      .then(res => res.json())
      .then(data => { setDeals(Array.isArray(data) ? data : []); setDealsLoading(false); })
      .catch(() => setDealsLoading(false));
  }, [fetchProfile]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fullName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || displayName || 'Rlystate User'
    : displayName || 'Rlystate User';

  const avatarLetter = fullName.charAt(0).toUpperCase();
  const avatarUrl = profile?.photoUrl || photoURL;

  const handleConnectCalendar = async () => {
    setCalendarBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      provider.addScope('https://www.googleapis.com/auth/calendar.freebusy');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        await api('/api/auth/connect-calendar', {
          method: 'POST',
          body: JSON.stringify({ accessToken: credential.accessToken }),
        });
        fetchProfile();
      }
    } catch (err) {
      console.error('Calendar connect error:', err);
    } finally {
      setCalendarBusy(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    setCalendarBusy(true);
    try {
      await api('/api/auth/calendar', { method: 'DELETE' });
      fetchProfile();
    } catch (err) {
      console.error('Calendar disconnect error:', err);
    } finally {
      setCalendarBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await api('/api/profile', { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        setDeleteError(body.error || 'Failed to delete account. Please try again.');
        setDeleteLoading(false);
        return;
      }
      logout();
    } catch {
      setDeleteError('Failed to delete account. Please try again.');
      setDeleteLoading(false);
    }
  };

  return (
    <div className="page-content" style={{ overflowY: 'auto', paddingBottom: 40 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title" style={{ fontSize: '1.5rem', margin: 0 }}>Profile</h1>
        <button
          onClick={() => navigate('/profile/edit', { state: { profile } })}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--text-secondary)',
            padding: '6px 14px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          Edit
        </button>
      </div>

      {/* Account card */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: 20,
        marginBottom: 20,
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Avatar + name + email */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}>
              {avatarLetter}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 3 }}>
              {profileLoading ? '...' : fullName}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.email || ''}
            </div>
          </div>
        </div>

        {/* Optional fields row */}
        {!profileLoading && (profile?.phone || profile?.zipCode) && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {profile.phone && (
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Phone</div>
                <div style={{ fontSize: '0.85rem' }}>{profile.phone}</div>
              </div>
            )}
            {profile.zipCode && (
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Zip</div>
                <div style={{ fontSize: '0.85rem' }}>{profile.zipCode}</div>
              </div>
            )}
          </div>
        )}

        {/* Google Calendar row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 2 }}>Google Calendar</div>
            <div style={{ fontSize: '0.75rem', color: profile?.calendarConnected ? 'var(--positive)' : 'var(--text-secondary)' }}>
              {profileLoading ? '...' : profile?.calendarConnected ? 'Connected' : 'Not connected'}
            </div>
          </div>
          {!profileLoading && (
            <button
              onClick={profile?.calendarConnected ? handleDisconnectCalendar : handleConnectCalendar}
              disabled={calendarBusy}
              style={{
                background: 'none',
                border: `1px solid ${profile?.calendarConnected ? 'rgba(255,255,255,0.12)' : 'rgba(94,106,210,0.5)'}`,
                color: profile?.calendarConnected ? 'var(--text-secondary)' : 'var(--accent)',
                padding: '6px 12px',
                borderRadius: 8,
                cursor: calendarBusy ? 'not-allowed' : 'pointer',
                fontSize: '0.78rem',
                fontWeight: 500,
                opacity: calendarBusy ? 0.5 : 1,
              }}
            >
              {calendarBusy ? '...' : profile?.calendarConnected ? 'Disconnect' : 'Connect'}
            </button>
          )}
        </div>

        {/* Log out */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'right' }}>
          <button
            onClick={logout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 500,
              padding: 0,
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {/* Closed Deals */}
      <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.05em' }}>
        Closed Deals
      </h2>

      {dealsLoading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '20px 0' }}>Loading...</div>
      ) : deals.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '20px 0' }}>
          No closed deals yet. Complete a negotiation to see it here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {deals.map(deal => (
            <div key={deal.listingId} style={{
              display: 'flex',
              gap: 12,
              padding: 12,
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255,255,255,0.06)',
              alignItems: 'center',
            }}>
              <div style={{
                width: 52,
                height: 52,
                flexShrink: 0,
                borderRadius: 8,
                backgroundImage: `url(${deal.imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: 'var(--bg-tertiary)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {deal.title}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 5,
                    background: deal.role === 'bought' ? 'rgba(94,106,210,0.2)' : 'rgba(16,185,129,0.15)',
                    color: deal.role === 'bought' ? 'var(--accent)' : 'var(--positive)',
                    border: deal.role === 'bought' ? '1px solid rgba(94,106,210,0.3)' : '1px solid rgba(16,185,129,0.3)',
                    letterSpacing: '0.5px',
                  }}>
                    {deal.role.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {formatDate(deal.date)}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--positive)', flexShrink: 0 }}>
                ${deal.finalPrice.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coming soon stubs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {['Verification', 'Payment Methods', 'Settings'].map(label => (
          <div key={label} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'not-allowed',
            opacity: 0.5,
          }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{label}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Coming soon</span>
          </div>
        ))}
      </div>

      {/* Delete My Account */}
      <button
        onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
        style={{
          width: '100%',
          background: 'none',
          border: '1px solid rgba(239,68,68,0.3)',
          color: 'var(--negative)',
          padding: '13px 16px',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 500,
        }}
      >
        Delete My Account
      </button>

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 100,
          padding: '0 0 env(safe-area-inset-bottom,0) 0',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '20px 20px 0 0',
            padding: '28px 24px 32px 24px',
            width: '100%',
            maxWidth: 480,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 10 }}>Delete your account?</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
              This will permanently remove your profile, listings, and deal history. This action cannot be undone.
            </p>
            {deleteError && (
              <p style={{ fontSize: '0.82rem', color: 'var(--negative)', marginBottom: 12 }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                disabled={deleteLoading}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'none',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  opacity: deleteLoading ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'var(--negative)',
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  opacity: deleteLoading ? 0.7 : 1,
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
