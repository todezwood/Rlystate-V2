import React, { createContext, useContext, useState } from 'react';
import { API_BASE } from '../lib/api';

interface AuthState {
  userId: string | null;
  displayName: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  displayName: null,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(
    localStorage.getItem('rlystate_user_id')
  );
  const [displayName, setDisplayName] = useState<string | null>(
    localStorage.getItem('rlystate_user_name')
  );
  const [nameInput, setNameInput] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = () => {
    localStorage.removeItem('rlystate_user_id');
    localStorage.removeItem('rlystate_user_name');
    setUserId(null);
    setDisplayName(null);
  };

  const handleLogin = async () => {
    if (!nameInput.trim()) return;
    setLoggingIn(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/mock-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: nameInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('rlystate_user_id', data.userId);
      localStorage.setItem('rlystate_user_name', data.displayName);
      setUserId(data.userId);
      setDisplayName(data.displayName);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  if (!userId) {
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
          Mock login for local testing
        </p>

        <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            placeholder="Enter your display name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
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
            onClick={handleLogin}
            disabled={loggingIn || !nameInput.trim()}
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: loggingIn ? 'var(--bg-tertiary, #1a1a1a)' : 'var(--accent, #6366f1)',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: loggingIn || !nameInput.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {loggingIn ? 'Creating session...' : 'Log In'}
          </button>
          {error && <div style={{ color: 'var(--negative, #ef4444)', fontSize: '0.875rem' }}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ userId, displayName, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
