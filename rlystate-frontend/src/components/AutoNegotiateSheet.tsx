import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface AutoNegotiateSheetProps {
  listing: {
    id: string;
    title: string;
    askingPrice: number;
  };
  onClose: () => void;
}

export const AutoNegotiateSheet: React.FC<AutoNegotiateSheetProps> = ({ listing, onClose }) => {
  const navigate = useNavigate();
  const [maxPrice, setMaxPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedMax = parseFloat(maxPrice);
  const isValid = !isNaN(parsedMax) && parsedMax > 0;
  const isAboveAsking = isValid && parsedMax >= listing.askingPrice;

  const handleStart = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api('/api/buyer/auto-negotiate', {
        method: 'POST',
        body: JSON.stringify({ listingId: listing.id, maxPrice: parsedMax })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start negotiation');
        return;
      }
      if (!data.conversationId) {
        setError('Could not start negotiation. Please try again.');
        return;
      }
      onClose();
      navigate(`/interact/${listing.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 40,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'var(--bg-secondary)',
        borderRadius: '24px 24px 0 0',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '20px 20px env(safe-area-inset-bottom, 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 80px, 32px)',
        zIndex: 50,
        maxHeight: '85vh',
        overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>
          Your AI agent will negotiate this deal for you.
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
          The agent will work to get you the best price within your budget. You'll need to approve the final deal before any payment is made. Nothing gets charged without your confirmation.
        </p>

        {/* Item context */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 12px', marginBottom: 16
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{listing.title}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 700 }}>Asking ${listing.askingPrice.toLocaleString()}</span>
        </div>

        {/* Max price input */}
        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
          What's your max price?
        </label>
        <input
          type="number"
          min="1"
          value={maxPrice}
          onChange={e => setMaxPrice(e.target.value)}
          placeholder="e.g. 500"
          style={{
            width: '100%', padding: '11px 14px',
            background: 'var(--bg-tertiary)',
            border: `1px solid ${isValid ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 10, color: 'white',
            fontSize: '1rem', fontFamily: 'inherit',
            marginBottom: 8,
          }}
        />

        {isAboveAsking && (
          <p style={{ fontSize: '0.75rem', color: '#F59E0B', marginBottom: 12 }}>
            Your max is at or above the asking price. The agent may accept immediately.
          </p>
        )}

        {error && (
          <p style={{ fontSize: '0.75rem', color: 'var(--negative)', marginBottom: 12 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px', borderRadius: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!isValid || loading}
            style={{
              flex: 1, padding: '11px', borderRadius: 10,
              background: isValid && !loading ? 'var(--accent)' : 'rgba(94,106,210,0.3)',
              border: 'none', color: 'white',
              fontWeight: 600, cursor: isValid && !loading ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem'
            }}
          >
            {loading ? 'Starting...' : 'Start Negotiating'}
          </button>
        </div>
      </div>
    </>
  );
};
