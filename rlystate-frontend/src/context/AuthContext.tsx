import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthState {
  userId: string | null;
  displayName: string | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  displayName: null,
  loading: true,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      const msg =
        err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential'
          ? 'Invalid email or password'
          : err.code === 'auth/email-already-in-use'
          ? 'Account already exists. Sign in instead.'
          : err.code === 'auth/weak-password'
          ? 'Password must be at least 6 characters'
          : err.message;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => { signOut(auth); };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary, #0a0a0a)',
        color: 'white',
      }}>
        Loading...
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary, #0a0a0a)',
        color: 'white',
        padding: '24px',
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>Rlystate</h1>
        <p style={{ color: 'var(--text-secondary, #888)', marginBottom: '32px', fontSize: '0.9rem' }}>
          {isSignUp ? 'Create your account' : 'Sign in to continue'}
        </p>

        <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-tertiary, #1a1a1a)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '1rem',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-tertiary, #1a1a1a)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '1rem',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !email.trim() || !password.trim()}
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: submitting ? 'var(--bg-tertiary, #1a1a1a)' : 'var(--accent, #6366f1)',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: submitting || !email.trim() || !password.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #888)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              padding: '8px',
            }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
          {error && (
            <div style={{ color: 'var(--negative, #ef4444)', fontSize: '0.875rem' }}>{error}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      userId: firebaseUser.uid,
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || null,
      loading: false,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
