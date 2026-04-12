import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = () => { signOut(auth); };

  return (
    <AuthContext.Provider value={{
      userId: firebaseUser?.uid ?? null,
      displayName: firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || null,
      loading,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
