import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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

export const ProfileEditPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { photoURL, displayName } = useAuth();

  // Initialize fields from route state immediately; fall back to API fetch
  const passedProfile: ProfileData | null = (location.state as { profile?: ProfileData })?.profile ?? null;

  // Split Firebase displayName as a fallback when DB values are null
  const firebaseParts = (displayName || '').trim().split(' ');
  const firebaseFirstName = firebaseParts[0] || '';
  const firebaseLastName = firebaseParts.slice(1).join(' ') || '';

  const [loading, setLoading] = useState(!passedProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(passedProfile?.firstName || firebaseFirstName);
  const [lastName, setLastName] = useState(passedProfile?.lastName || firebaseLastName);
  const [phone, setPhone] = useState(passedProfile?.phone || '');
  const [zipCode, setZipCode] = useState(passedProfile?.zipCode || '');
  const [email, setEmail] = useState(passedProfile?.email || '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(passedProfile?.photoUrl ?? null);

  useEffect(() => {
    if (passedProfile) return;
    api('/api/profile')
      .then(res => res.json())
      .then((data: ProfileData) => {
        setFirstName(data.firstName || firebaseFirstName);
        setLastName(data.lastName || firebaseLastName);
        setPhone(data.phone || '');
        setZipCode(data.zipCode || '');
        setEmail(data.email || '');
        setPhotoUrl(data.photoUrl);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          phone: phone.trim() || null,
          zipCode: zipCode.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || 'Failed to save. Please try again.');
        setSaving(false);
        return;
      }
      navigate('/profile');
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  };

  const avatarUrl = photoUrl || photoURL;
  const initials = (firstName.charAt(0) || email.charAt(0) || '?').toUpperCase();

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginBottom: 6,
    display: 'block',
  };

  return (
    <div className="page-content" style={{ overflowY: 'auto', paddingBottom: 40 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <button
          onClick={() => navigate('/profile')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            padding: 0,
          }}
        >
          Cancel
        </button>
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Edit Profile</h1>
        <div style={{ width: 52 }} />
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '20px 0' }}>Loading...</div>
      ) : (
        <>
          {/* Avatar */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                fontWeight: 700,
                color: '#fff',
              }}>
                {initials}
              </div>
            )}
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  maxLength={64}
                  placeholder="First name"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  maxLength={64}
                  placeholder="Last name"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Phone (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                maxLength={20}
                placeholder="e.g. 212-555-0100"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Zip code (optional)</label>
              <input
                type="text"
                value={zipCode}
                onChange={e => setZipCode(e.target.value)}
                maxLength={10}
                placeholder="e.g. 10001"
                style={inputStyle}
              />
            </div>

            {/* Email: locked */}
            <div>
              <label style={labelStyle}>Email</label>
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255,255,255,0.05)',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}>
                {email}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 5, opacity: 0.7 }}>
                Email cannot be changed. It is your account identifier.
              </div>
            </div>

            {error && (
              <div style={{ fontSize: '0.82rem', color: 'var(--negative)' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                background: saving ? 'var(--bg-tertiary)' : 'var(--accent)',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                marginTop: 8,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>

          </div>
        </>
      )}
    </div>
  );
};
