import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export const SellerPage = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<string[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // My Inventory state
  const [myListings, setMyListings] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  const fetchMyListings = () => {
    api('/api/listings/me')
      .then(res => res.json())
      .then(data => {
        setMyListings(data);
        setInventoryLoading(false);
      })
      .catch(() => setInventoryLoading(false));
  };

  useEffect(() => {
    fetchMyListings();
  }, []);

  // Smart Image Compression to bypass Anthropic 5MB limits
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // Claude 3.5 Sonnet natively caps image analysis at 1568px on the longest edge.
          // By scaling exactly to its peak vision limits, we maximize quality while maintaining a ~1.5MB JPEG.
          const MAX_SIZE = 1568;

          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // 90% quality gives us near-lossless clarity for the AI while staying far under 5MB
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      if (files.some(f => f.name.toLowerCase().endsWith('.heic'))) {
        setError("HEIC unsupported. Please screenshot your photo to convert it to PNG first.");
        return;
      }
      if (files.length > 5) {
        setError("Maximum 5 photos allowed per listing.");
        return;
      }
      setIsLoading(true);
      const compressedImages = await Promise.all(files.map(f => resizeImage(f)));
      setImages(compressedImages);
      setUploadedImageUrls([]);
      setIsLoading(false);
      setError(null);
    }
  };

  const submitToListingAgent = async () => {
    if (images.length === 0) return setError("Please upload at least one image.");
    setIsLoading(true); setError(null); setDraft(null);

    try {
      let gcsPublicUrls = [...uploadedImageUrls];

      // 1. Upload to GCS if we haven't already for these exact images
      if (gcsPublicUrls.length !== images.length) {
        gcsPublicUrls = await Promise.all(images.map(async (img, idx) => {
          // Dev path: Handle without GCP Auth Keys
          if (import.meta.env.VITE_USE_DIRECT_UPLOAD === 'true') {
             const uploadRes = await api('/api/listings/upload-direct', {
               method: 'POST',
               body: JSON.stringify({ base64: img, fileName: `seller_upload_${idx}.jpg`, contentType: 'image/jpeg' })
             });
             const uploadData = await uploadRes.json();
             if (!uploadRes.ok) throw new Error("Local direct upload failed");
             return uploadData.publicUrl;
          }
        
          // Production Path: Strict GCS Signed URLs using Cloud IAM
          const blob = await (await fetch(img)).blob();
          
          const uploadUrlRes = await api('/api/listings/upload-url', {
            method: 'POST',
            body: JSON.stringify({ fileName: `seller_upload_${idx}.jpg`, contentType: blob.type })
          });
          const uploadUrlData = await uploadUrlRes.json();
          if (!uploadUrlRes.ok) throw new Error("Failed to get GCS upload URL");

          const gcsUpload = await fetch(uploadUrlData.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': blob.type },
            body: blob
          });
          if (!gcsUpload.ok) throw new Error("Failed to upload image chunks to Google Cloud Storage");

          return uploadUrlData.publicUrl;
        }));
        
        setUploadedImageUrls(gcsPublicUrls);
      }

      // 2. Send GCS URLs to Claude Vision for evaluation
      const res = await api('/api/listings/evaluate', {
        method: 'POST',
        body: JSON.stringify({ imageUrls: gcsPublicUrls, title, description })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to evaluate listing");
      setDraft(data);
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const publishListing = async () => {
    setIsLoading(true);
    try {
      const res = await api('/api/listings/publish', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: draft.rationale,
          imageUrls: uploadedImageUrls,
          askingPrice: draft.suggestedHighPrice,
          floorPrice: draft.suggestedLowPrice
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to publish");

      // Reset form and refresh inventory
      setDraft(null);
      setImages([]);
      setUploadedImageUrls([]);
      setTitle('');
      setDescription('');
      fetchMyListings();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-content">
      <h1 className="page-title">Seller Hub</h1>
      <p className="page-subtitle">Snap a photo. Let the AI price it.</p>

      {!draft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Upload Photo(s) (Required, Max 5)</label>
            <input type="file" multiple accept="image/*" onChange={handleImageChange} style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.1)' }} />
            {images.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                {images.map((img, i) => (
                  <img key={i} src={img} style={{ height: '80px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                ))}
              </div>
            )}
          </div>
          <div>
             <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}> What is it? </label>
             <input type="text" placeholder="e.g. Vintage Rolex Submariner" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', marginBottom: '16px' }} />
             
             <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}> Help us understand your product a little better (Optional) </label>
             <textarea placeholder="e.g. Bought it two years ago, barely used. There's a tiny scratch near the kickstand, but it rides perfectly." value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', minHeight: '80px', padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', resize: 'vertical' }} />
          </div>
          <button onClick={submitToListingAgent} disabled={isLoading || images.length === 0} style={{ backgroundColor: isLoading ? 'var(--bg-tertiary)' : 'var(--accent)', color: 'white', padding: '14px', borderRadius: 'var(--radius-sm)', border: 'none', fontWeight: 600, marginTop: '8px', cursor: isLoading || images.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
            {isLoading ? "Analyzing (Multi-Modal Vision)..." : "Analyze with AI Listing Agent"}
          </button>
          {error && <div style={{ color: 'var(--negative)', fontSize: '0.875rem' }}>{error}</div>}
        </div>
      )}

      {draft && (
        <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--positive)' }}>Draft Generated!</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '16px', lineHeight: 1.5 }}>"{draft.rationale}"</p>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '24px' }}>
             <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Invisible Negotiation Parameters</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Suggested Public Ask:</span>
              <span style={{ fontWeight: 'bold' }}>${draft.suggestedHighPrice}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>AI Auto-Accept Floor:</span>
              <span style={{ color: 'var(--negative)', fontWeight: 'bold' }}>${draft.suggestedLowPrice}</span>
            </div>
          </div>
          <button onClick={publishListing} disabled={isLoading} style={{ width: '100%', backgroundColor: isLoading ? 'grey' : 'white', color: 'black', padding: '14px', borderRadius: 'var(--radius-sm)', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
            {isLoading ? "Publishing..." : "Publish to Storefront"}
          </button>
        </div>
      )}

      {/* My Inventory */}
      <div style={{ marginTop: '40px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px' }}>My Inventory</h2>
        {inventoryLoading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading your listings...</div>
        ) : myListings.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No listings yet. Upload your first item above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myListings.map(listing => (
              <div key={listing.id} style={{
                display: 'flex',
                gap: '12px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ display: 'flex', overflowX: 'auto', gap: '4px', width: '84px', flexShrink: 0, scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
                  {(listing.imageUrls?.length > 0 ? listing.imageUrls : [listing.imageUrl]).map((url: string, i: number) => (
                    <div key={i} style={{ width: '80px', minHeight: '80px', flexShrink: 0, scrollSnapAlign: 'start', backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  ))}
                </div>
                <div style={{ padding: '10px 10px 10px 0', flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{listing.title}</div>
                  
                  {listing.status === 'ACTIVE' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--positive)', fontWeight: 600 }}>
                        List Price: ${listing.askingPrice}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 500 }}>
                        Minimum Acceptable: ${listing.floorPrice}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--positive)', fontWeight: 600 }}>
                        Final Agreed Deal: ${listing.agreedPrice || listing.askingPrice}
                      </div>
                    </div>
                  )}

                  <div style={{
                    fontSize: '0.7rem',
                    color: listing.status === 'ACTIVE' ? 'var(--positive)' : 'var(--accent)',
                    marginTop: '4px',
                    textTransform: 'uppercase',
                  }}>
                    {listing.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
