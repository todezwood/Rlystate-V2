import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { api } from '../lib/api';

interface Listing {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  askingPrice: number;
  isOwn?: boolean;
}

export const FeedPage = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/listings')
      .then(res => res.json())
      .then(data => {
        setListings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching feed", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="page-content">
      <h1 className="page-title">Feed</h1>
      <p className="page-subtitle">Discover curated second-hand luxury.</p>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>Loading live feed...</div>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
           No active listings yet. Be the first to sell!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {listings.map(listing => (
            <div key={listing.id} style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>

              <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', height: '240px', backgroundColor: 'var(--bg-secondary)' }}>
                {((listing.imageUrls?.length ?? 0) > 0 ? listing.imageUrls! : [listing.imageUrl]).map((url: string, i: number) => (
                  <div key={i} style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'start', backgroundImage: `url(${url})`, backgroundPosition: 'center', backgroundSize: 'cover' }} />
                ))}
              </div>

              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{listing.title}</h3>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--positive)' }}>${listing.askingPrice}</span>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {listing.description}
                </p>

                <button
                  onClick={() => navigate(`/interact/${listing.id}`)}
                  style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <MessageSquare size={18} /> Negotiate with AI
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
