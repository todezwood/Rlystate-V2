import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface ConversationItem {
  conversationId: string;
  autonomyMode: string;
  status: string;
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConversations = () => {
    api('/api/chat/mine')
      .then(res => res.json())
      .then(data => { setConversations(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchConversations();
    intervalRef.current = setInterval(fetchConversations, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const formatTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const truncate = (text: string, max: number) => text.length > max ? text.slice(0, max) + '...' : text;

  // Show: active conversations + deposit-held (deal locked, awaiting buyer action) + walked-away (muted)
  const visible = conversations.filter(c =>
    c.status === 'active' || c.listing.status === 'DEPOSIT_HELD' || c.status === 'walked_away'
  );

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
          No active negotiations yet. Head to Search to find something you like.
        </p>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ overflowY: 'auto' }}>
      <h1 className="page-title" style={{ fontSize: '1.5rem', marginBottom: 20 }}>Buying</h1>

      <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.05em' }}>
        Negotiating
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map(c => {
          const isDepositReady = c.listing.status === 'DEPOSIT_HELD';
          const isWalkedAway = c.status === 'walked_away';
          const isAuto = c.autonomyMode === 'autonomous';

          return (
            <div
              key={c.conversationId}
              onClick={() => navigate(`/interact/${c.listing.id}`)}
              style={{
                display: 'flex', gap: 12, padding: 12,
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: isDepositReady
                  ? '1px solid rgba(16,185,129,0.4)'
                  : isWalkedAway
                  ? '1px solid rgba(255,255,255,0.04)'
                  : '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                opacity: isWalkedAway ? 0.6 : 1,
              }}
            >
              {/* Thumbnail */}
              <div style={{
                width: 56, height: 56, flexShrink: 0, borderRadius: 8,
                backgroundImage: `url(${(c.listing.imageUrls?.length ? c.listing.imageUrls : [c.listing.imageUrl])[0]})`,
                backgroundSize: 'cover', backgroundPosition: 'center'
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.listing.title}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0, marginLeft: 8 }}>
                    ${c.listing.askingPrice}
                  </span>
                </div>

                {/* Status indicators */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  {isAuto && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'rgba(94,106,210,0.2)', color: 'var(--accent)', border: '1px solid rgba(94,106,210,0.3)', letterSpacing: '0.5px' }}>
                      AI AGENT
                    </span>
                  )}
                  {isDepositReady && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'rgba(16,185,129,0.15)', color: 'var(--positive)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      DEAL LOCKED
                    </span>
                  )}
                  {isWalkedAway && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                      ENDED
                    </span>
                  )}
                </div>

                {c.lastMessage && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {truncate(c.lastMessage.content.replace(/DEAL ACCEPTED[^.]*/gi, ''), 55)}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', flexShrink: 0, marginLeft: 8 }}>
                      {formatTime(c.lastMessage.createdAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
