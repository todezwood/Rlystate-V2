import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface ConversationItem {
  conversationId: string;
  listing: {
    id: string;
    title: string;
    imageUrl: string;
    imageUrls?: string[];
    askingPrice: number;
    agreedPrice: number | null;
    status: string;
  };
  lastMessage: {
    content: string;
    sender: string;
    createdAt: string;
  } | null;
}

export const BuyingPage = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/chat/mine')
      .then(res => res.json())
      .then(data => {
        setConversations(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeNegotiations = conversations.filter(c => c.listing.status === 'ACTIVE');
  const lockedDeals = conversations.filter(c => c.listing.status === 'DEPOSIT_HELD' || c.listing.status === 'SOLD');

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
          No active deals yet. Browse the Feed to find something you like.
        </p>
      </div>
    );
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + '...' : text;

  return (
    <div className="page-content" style={{ overflowY: 'auto' }}>
      <h1 className="page-title" style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Buying</h1>

      {activeNegotiations.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.05em' }}>
            Active Negotiations
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeNegotiations.map(c => (
              <div
                key={c.conversationId}
                onClick={() => navigate(`/interact/${c.listing.id}`)}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', width: '64px', flexShrink: 0, scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
                  {(c.listing.imageUrls?.length ? c.listing.imageUrls : [c.listing.imageUrl]).map((url, i) => (
                    <div key={i} style={{ width: '56px', height: '56px', flexShrink: 0, scrollSnapAlign: 'start', backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 'var(--radius-sm)' }} />
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{c.listing.title}</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem', flexShrink: 0 }}>${c.listing.askingPrice}</span>
                  </div>
                  {c.lastMessage && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {truncate(c.lastMessage.content.replace('DEAL ACCEPTED.', '').replace('DEAL ACCEPTED', ''), 60)}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', flexShrink: 0, marginLeft: '8px' }}>
                        {formatTime(c.lastMessage.createdAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lockedDeals.length > 0 && (
        <div>
          <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.05em' }}>
            Locked Deals
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {lockedDeals.map(c => (
              <div
                key={c.conversationId}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', width: '64px', flexShrink: 0, scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
                  {(c.listing.imageUrls?.length ? c.listing.imageUrls : [c.listing.imageUrl]).map((url, i) => (
                    <div key={i} style={{ width: '56px', height: '56px', flexShrink: 0, scrollSnapAlign: 'start', backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 'var(--radius-sm)' }} />
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{c.listing.title}</span>
                    <span style={{ color: 'var(--positive)', fontWeight: 600, fontSize: '0.85rem', flexShrink: 0 }}>${c.listing.agreedPrice || c.listing.askingPrice}</span>
                  </div>
                  <span style={{
                    display: 'inline-block',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: c.listing.status === 'SOLD' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                    color: c.listing.status === 'SOLD' ? 'var(--positive)' : '#eab308',
                  }}>
                    {c.listing.status === 'DEPOSIT_HELD' ? 'Deposit Held' : 'Sold'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
