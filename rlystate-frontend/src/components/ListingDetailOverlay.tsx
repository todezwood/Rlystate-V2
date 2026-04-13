import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface ListingDetailOverlayProps {
  listing: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    imageUrls?: string[];
    askingPrice: number;
    isOwn?: boolean;
  };
  onClose: () => void;
}

export const ListingDetailOverlay: React.FC<ListingDetailOverlayProps> = ({ listing, onClose }) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const navigatingAway = useRef(false);

  const images = (listing.imageUrls?.length ?? 0) > 0 ? listing.imageUrls! : [listing.imageUrl];
  const showDots = images.length > 1;

  // Fade in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Browser back button
  useEffect(() => {
    const closedByPopstate = { current: false };
    window.history.pushState({ listingDetail: true }, '');
    const handler = () => { closedByPopstate.current = true; onClose(); };
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      if (!closedByPopstate.current && !navigatingAway.current) window.history.back();
    };
  }, [onClose]);

  // Dot indicators via IntersectionObserver
  const imageRefCallback = useCallback((node: HTMLDivElement | null, index: number) => {
    if (!node) return;
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const idx = Number(entry.target.getAttribute('data-index'));
              if (!isNaN(idx)) setActiveImage(idx);
            }
          }
        },
        { root: carouselRef.current, threshold: 0.6 }
      );
    }
    node.setAttribute('data-index', String(index));
    observerRef.current.observe(node);
  }, []);

  // Cleanup observer
  useEffect(() => {
    return () => { observerRef.current?.disconnect(); };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 200,
          opacity: visible ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 201,
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          opacity: visible ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}
        onClick={onClose}
      >
        <div
          style={{
            position: 'relative',
            maxWidth: 480,
            width: '100%',
            marginTop: 48,
            marginBottom: 40,
            borderRadius: 20,
            overflow: 'hidden',
            background: 'var(--bg-secondary)',
            alignSelf: 'flex-start',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 202,
            }}
          >
            <X size={18} />
          </button>

          {/* Photo carousel */}
          <div
            ref={carouselRef}
            style={{
              display: 'flex',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              aspectRatio: '4/3',
              backgroundColor: 'var(--bg-tertiary)',
              overscrollBehavior: 'contain',
            }}
          >
            {images.map((url, i) => (
              <div
                key={i}
                ref={(node) => imageRefCallback(node, i)}
                style={{
                  flex: '0 0 100%',
                  height: '100%',
                  scrollSnapAlign: 'start',
                  backgroundImage: `url(${url})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  backgroundColor: 'var(--bg-tertiary)',
                }}
              />
            ))}
          </div>

          {/* Dot indicators */}
          {showDots && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              padding: '12px 0',
            }}>
              {images.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: i === activeImage ? 'white' : 'rgba(255,255,255,0.3)',
                    transition: 'background 200ms ease',
                  }}
                />
              ))}
            </div>
          )}

          {/* Details */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1.3, flex: 1, marginRight: 12 }}>
                {listing.title}
              </h2>
              <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--positive)', flexShrink: 0 }}>
                ${listing.askingPrice.toLocaleString()}
              </span>
            </div>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              marginBottom: 24,
              whiteSpace: 'pre-wrap',
            }}>
              {listing.description}
            </p>

            {/* Action buttons */}
            {!listing.isOwn && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { navigatingAway.current = true; navigate(`/interact/${listing.id}?mode=manual`); }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 10,
                    background: 'transparent',
                    border: '1.5px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Negotiate
                </button>
                <button
                  onClick={() => { navigatingAway.current = true; navigate(`/interact/${listing.id}`); }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 10,
                    background: 'var(--accent)',
                    border: 'none',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Negotiate with AI
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
