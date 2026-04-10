import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface DealItem {
  id: string;
  role: 'Bought' | 'Sold';
  listingTitle: string;
  imageUrl: string;
  finalPrice: number;
  completedAt: string;
}

export const ProfilePage = () => {
  const { displayName, logout } = useAuth();
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/profile/deals')
      .then(res => res.json())
      .then(data => { setDeals(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="page-content" style={{ overflowY: 'auto' }}>
      <h1 className="page-title" style={{ fontSize: '1.5rem', marginBottom: 20 }}>Profile</h1>

      {/* Account info */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        marginBottom: 20,
        border: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 3 }}>
            {displayName || 'Rlystate User'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {''}
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--text-secondary)',
            padding: '7px 14px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          Log out
        </button>
      </div>

      {/* Closed Deals */}
      <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.05em' }}>
        Closed Deals
      </h2>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '20px 0' }}>Loading...</div>
      ) : deals.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '20px 0' }}>
          No closed deals yet. Complete a negotiation to see it here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {deals.map(deal => (
            <div key={deal.id} style={{
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
                  {deal.listingTitle}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 5,
                    background: deal.role === 'Bought' ? 'rgba(94,106,210,0.2)' : 'rgba(16,185,129,0.15)',
                    color: deal.role === 'Bought' ? 'var(--accent)' : 'var(--positive)',
                    border: deal.role === 'Bought' ? '1px solid rgba(94,106,210,0.3)' : '1px solid rgba(16,185,129,0.3)',
                    letterSpacing: '0.5px',
                  }}>
                    {deal.role.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {formatDate(deal.completedAt)}
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

      {/* Future sections placeholder */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
    </div>
  );
};
