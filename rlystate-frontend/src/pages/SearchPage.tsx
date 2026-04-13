import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { AutoNegotiateSheet } from '../components/AutoNegotiateSheet';
import { ListingDetailOverlay } from '../components/ListingDetailOverlay';

const resizeImage = (file: File, maxDim = 1568): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

interface Listing {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  askingPrice: number;
  floorPrice?: number;
  status: string;
  isOwn?: boolean;
  similarity?: number;
}

export const SearchPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const [query, setQuery] = useState('');
  const [refPhotos, setRefPhotos] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Listing[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [sheetListing, setSheetListing] = useState<Listing | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  // Swipe guard: track pointer start to distinguish taps from swipes
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }, []);
  const handleCardClick = useCallback((listing: Listing) => {
    return (e: React.MouseEvent) => {
      if (pointerStart.current) {
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
      }
      setSelectedListing(listing);
    };
  }, []);

  useEffect(() => {
    api('/api/listings')
      .then(res => res.json())
      .then(data => { setListings(Array.isArray(data) ? data : []); setLoadingFeed(false); })
      .catch(() => setLoadingFeed(false));
  }, []);

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 3 - refPhotos.length;
    const toProcess = files.slice(0, remaining);
    const resized = await Promise.all(toProcess.map(f => resizeImage(f)));
    setRefPhotos(prev => [...prev, ...resized]);
    e.target.value = '';
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      // Upload reference photos if any, otherwise pass URLs as base64 data URIs directly
      const res = await api('/api/buyer/search', {
        method: 'POST',
        body: JSON.stringify({
          descriptionText: query,
          referenceImageUrls: refPhotos.length > 0 ? refPhotos : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) { setSearchError(data.error || 'Search failed'); return; }
      setSearchResults(data.listings);
    } catch {
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchResults(null);
    setQuery('');
    setRefPhotos([]);
    setSearchError(null);
  };

  const displayListings = searchResults ?? listings;
  const isSearchActive = searchResults !== null;

  return (
    <div className="page-content">
      <h1 className="page-title">Search</h1>

      {/* AI Search Input */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>What are you looking for?</p>
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='e.g. "mid century modern couch, dark leather"'
          rows={2}
          style={{
            width: '100%', background: 'var(--bg-tertiary)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: '0.9rem',
            fontFamily: 'inherit', resize: 'none', marginBottom: 10
          }}
        />

        {/* Reference photo row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          {refPhotos.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
              <div style={{ width: 46, height: 46, borderRadius: 8, backgroundImage: `url(${src})`, backgroundSize: 'cover', border: '1px solid rgba(255,255,255,0.15)' }} />
              <button
                onClick={() => setRefPhotos(prev => prev.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'var(--negative)', border: 'none', color: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>
          ))}
          {refPhotos.length < 3 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ width: 46, height: 46, borderRadius: 8, background: 'var(--bg-tertiary)', border: '1.5px dashed rgba(255,255,255,0.15)', color: 'var(--text-secondary)', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >+</button>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reference photos (optional)</span>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoAdd} style={{ display: 'none' }} />
        </div>

        <button
          onClick={handleSearch}
          disabled={!query.trim() || searching}
          style={{
            width: '100%', padding: '11px', borderRadius: 10,
            background: query.trim() && !searching ? 'var(--accent)' : 'rgba(94,106,210,0.3)',
            border: 'none', color: 'white', fontWeight: 600, cursor: query.trim() && !searching ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.9rem'
          }}
        >
          <Search size={16} />
          {searching ? 'Searching...' : 'Find Items'}
        </button>
        {searchError && <p style={{ fontSize: '0.8rem', color: 'var(--negative)', marginTop: 8 }}>{searchError}</p>}
      </div>

      {/* Active search banner */}
      {isSearchActive && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(94,106,210,0.1)', border: '1px solid rgba(94,106,210,0.25)', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 500 }}>AI results for "{query}"</span>
          <button onClick={clearSearch} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}>
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {/* Section label */}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontWeight: 500 }}>
        {isSearchActive ? 'AI Suggestions' : 'All Listings'}
      </p>

      {/* Listings */}
      {loadingFeed && !isSearchActive ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>Loading...</div>
      ) : displayListings.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
          {isSearchActive ? 'No listings matched your search.' : 'No active listings yet. Be the first to sell!'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {displayListings.map((listing) => (
            <div key={listing.id} onPointerDown={handlePointerDown} onClick={handleCardClick(listing)} style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', height: 240, backgroundColor: 'var(--bg-secondary)' }}>
                {((listing.imageUrls?.length ?? 0) > 0 ? listing.imageUrls! : [listing.imageUrl]).map((url: string, i: number) => (
                  <div key={i} style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'start', backgroundImage: `url(${url})`, backgroundPosition: 'center', backgroundSize: 'cover' }} />
                ))}
              </div>
              <div style={{ padding: 16 }}>
                {isSearchActive && listing.similarity != null && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--positive)', marginBottom: 6, fontWeight: 500 }}>
                    {Math.round(listing.similarity * 100)}% match
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{listing.title}</h3>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--positive)', flexShrink: 0, marginLeft: 8 }}>${listing.askingPrice}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 14, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {listing.description}
                </p>
                {listing.isOwn ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>
                    Your listing
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/interact/${listing.id}?mode=manual`); }}
                      style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'transparent', border: '1.5px solid rgba(255,255,255,0.15)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Negotiate
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSheetListing(listing); }}
                      style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--accent)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Negotiate with AI
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedListing && (
        <ListingDetailOverlay
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onNegotiateAI={() => {
            const listing = selectedListing;
            setSelectedListing(null);
            setSheetListing(listing);
          }}
        />
      )}

      {sheetListing && (
        <AutoNegotiateSheet
          listing={sheetListing}
          onClose={() => setSheetListing(null)}
        />
      )}
    </div>
  );
};
