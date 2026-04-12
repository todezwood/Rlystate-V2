import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { signInWithRedirect, signInWithPopup, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');

const GoogleLogo: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const RlystateLogo: React.FC = () => (
  <svg width="28" height="27" viewBox="0 0 48 46" fill="none">
    <path d="M24 2L44 12V34L24 44L4 34V12L24 2Z" fill="#863bff" opacity="0.9" />
    <path d="M24 8L38 16V30L24 38L10 30V16L24 8Z" fill="#7e14ff" opacity="0.6" />
    <path d="M24 14L32 19V27L24 32L16 27V19L24 14Z" fill="#47bfff" opacity="0.8" />
  </svg>
);

const steps = [
  {
    icon: '📸',
    title: 'Snap a photo',
    body: 'Describe the item. AI generates the listing and a market-calibrated price band in seconds.',
  },
  {
    icon: '🤝',
    title: 'AI handles the negotiation',
    body: 'A buyer makes an offer. Your agent negotiates within your floor. You are not in the conversation.',
  },
  {
    icon: '✅',
    title: 'Show up. Get paid.',
    body: 'Deal agreed. Deposit paid. Calendar invite sent. You show up when the deal is already done.',
  },
];

const agents = [
  {
    icon: '📋',
    title: 'Listing Agent',
    body: 'Takes your photo and description and generates a complete listing with a market-calibrated price band. Your item is ready to sell in seconds.',
  },
  {
    icon: '🏠',
    title: 'Seller Agent',
    body: 'Acts as your personal broker. Answers buyer questions, negotiates within your floor, and never accepts below your minimum.',
  },
  {
    icon: '🛒',
    title: 'Buyer Agent',
    body: 'Represents the buyer in negotiation. Works toward the best deal for their human while your seller agent works for yours.',
  },
  {
    icon: '📅',
    title: 'Coordination Agent',
    body: 'Once a deal is agreed and deposit is confirmed, finds a mutual pickup time, sends calendar invites, and closes the loop.',
  },
];

export const LandingPage: React.FC = () => {
  const { userId, loading } = useAuth();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInProcessing, setSignInProcessing] = useState(true);

  useEffect(() => {
    getRedirectResult(auth)
      .then(result => {
        if (!result) return;
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          api('/api/auth/connect-calendar', {
            method: 'POST',
            body: JSON.stringify({ accessToken: credential.accessToken }),
          }).catch(() => {});
        }
      })
      .catch(() => {
        setSignInError('Sign-in failed. Please try again.');
      })
      .finally(() => {
        setSignInProcessing(false);
      });
  }, []);

  const handleSignIn = () => {
    setSignInError(null);
    setSignInProcessing(true);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      signInWithRedirect(auth, googleProvider);
    } else {
      // Use .then() (not await) so the callback fires immediately if the promise resolves.
      // On Firebase Hosting with COOP headers, the popup promise may hang — navigation is
      // driven by onAuthStateChanged in AuthContext, so we do not depend on this resolving.
      signInWithPopup(auth, googleProvider)
        .then(result => {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            api('/api/auth/connect-calendar', {
              method: 'POST',
              body: JSON.stringify({ accessToken: credential.accessToken }),
            }).catch(() => {});
          }
        })
        .catch(() => {
          setSignInError('Sign-in failed. Please try again.');
          setSignInProcessing(false);
        });
    }
  };

  if (userId) return <Navigate to="/feed" replace />;

  if (loading || signInProcessing) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'white',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      WebkitFontSmoothing: 'antialiased' as const,
    }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px 60px 20px' }}>

        {/* Logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '24px 0 32px 0' }}>
          <RlystateLogo />
          <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.5px' }}>Rlystate</span>
        </div>

        {/* Tagline */}
        <h1 style={{
          fontSize: '32px',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-1px',
          margin: '0 0 16px 0',
        }}>
          Snap it.<br />Let AI<br />close the deal.
        </h1>

        {/* Subheadline */}
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          lineHeight: 1.65,
          margin: '0 0 32px 0',
        }}>
          Take a photo of anything worth selling. AI handles pricing, listing, negotiation,
          scheduling, and payment. You show up when the deal is done.
        </p>

        <button
          onClick={handleSignIn}
          disabled={signInProcessing}
          style={{
            width: '100%',
            background: '#fff',
            color: '#111',
            border: 'none',
            borderRadius: '12px',
            padding: '14px 16px',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '8px',
            cursor: signInProcessing ? 'not-allowed' : 'pointer',
            opacity: signInProcessing ? 0.6 : 1,
          }}
        >
          <GoogleLogo />
          Sign in with Google
        </button>

        {signInError && (
          <p style={{
            fontSize: '12px',
            color: '#f87171',
            textAlign: 'center' as const,
            margin: '0 0 6px 0',
          }}>
            {signInError}
          </p>
        )}

        {/* We collect disclosure */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '10px',
          padding: '10px 12px',
          marginBottom: '52px',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            marginBottom: '8px',
          }}>
            We collect
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
            {['First name', 'Last name', 'Email'].map((label) => (
              <span key={label} style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
                padding: '3px 8px',
              }}>
                {label}
              </span>
            ))}
            <span style={{
              fontSize: '11px',
              color: 'var(--accent)',
              background: 'rgba(94,106,210,0.1)',
              border: '1px solid rgba(94,106,210,0.25)',
              borderRadius: '6px',
              padding: '3px 8px',
            }}>
              Calendar access
            </span>
          </div>
        </div>

        {/* How it works */}
        <div style={sectionLabel}>How it works</div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '20px', marginBottom: '48px' }}>
          {steps.map((step) => (
            <div key={step.title} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '36px',
                height: '36px',
                background: 'var(--bg-secondary)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0,
              }}>
                {step.icon}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '3px' }}>{step.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Agent cards */}
        <div style={sectionLabel}>The agents working for you</div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginBottom: '48px' }}>
          {agents.map((agent) => (
            <div key={agent.title} style={{
              background: 'var(--bg-secondary)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '14px',
              padding: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                }}>
                  {agent.icon}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>{agent.title}</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                {agent.body}
              </p>
            </div>
          ))}
        </div>

        {/* Demo moment */}
        <div style={sectionLabel}>See it in action</div>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '14px',
          marginBottom: '16px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            paddingBottom: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>Walnut Dining Table</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Asking $450</div>
            </div>
            <span style={{
              background: 'rgba(16,185,129,0.1)',
              color: '#10B981',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 8px',
            }}>
              DEAL REACHED
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px 12px 12px 3px', padding: '8px 11px', fontSize: '11px', color: '#E4E4E7', lineHeight: 1.5 }}>
                Hi, would you take $380 for the table?
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '2px', marginLeft: '3px' }}>Buyer Agent</div>
            </div>
            <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
              <div style={{ background: 'var(--accent)', borderRadius: '12px 12px 3px 12px', padding: '8px 11px', fontSize: '11px', color: '#fff', lineHeight: 1.5 }}>
                It's solid walnut, great condition. Best I can do is $430.
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '2px', textAlign: 'right' as const, marginRight: '3px' }}>Seller Agent</div>
            </div>
            <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px 12px 12px 3px', padding: '8px 11px', fontSize: '11px', color: '#E4E4E7', lineHeight: 1.5 }}>
                Fair enough. $410 and we have a deal?
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '2px', marginLeft: '3px' }}>Buyer Agent</div>
            </div>
            <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
              <div style={{ background: 'var(--accent)', borderRadius: '12px 12px 3px 12px', padding: '8px 11px', fontSize: '11px', color: '#fff', lineHeight: 1.5 }}>
                Deal. $410 it is. Sending a deposit link now.
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '2px', textAlign: 'right' as const, marginRight: '3px' }}>Seller Agent</div>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' as const, lineHeight: 1.6, margin: 0 }}>
          Real negotiation between two AI agents. Neither human typed a single message.
        </p>

      </div>
    </div>
  );
};

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--accent)',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  marginBottom: '16px',
};
