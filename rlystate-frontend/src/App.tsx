import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Search, ShoppingBag, Store, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { SearchPage } from './pages/SearchPage';
import { BuyingPage } from './pages/BuyingPage';
import { SellerPage } from './pages/SellerPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProfileEditPage } from './pages/ProfileEditPage';
import { InteractPage } from './pages/InteractPage';
import './index.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userId, loading } = useAuth();
  if (loading) {
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
  if (!userId) return <Navigate to="/" replace />;
  return <>{children}</>;
};

function AppLayout() {
  const location = useLocation();
  const hideNav = location.pathname === '/' || location.pathname === '/profile/edit' || location.pathname.startsWith('/interact/');

  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/feed" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/buying" element={<ProtectedRoute><BuyingPage /></ProtectedRoute>} />
        <Route path="/seller" element={<ProtectedRoute><SellerPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/profile/edit" element={<ProtectedRoute><ProfileEditPage /></ProtectedRoute>} />
        <Route path="/interact/:id" element={<ProtectedRoute><InteractPage /></ProtectedRoute>} />
      </Routes>

      {!hideNav && (
        <nav className="bottom-nav">
          <NavLink to="/feed" end className={({ isActive }) => (isActive ? 'active' : '')}>
            <Search size={24} />
            <span>Search</span>
          </NavLink>
          <NavLink to="/buying" className={({ isActive }) => (isActive ? 'active' : '')}>
            <ShoppingBag size={24} />
            <span>Buying</span>
          </NavLink>
          <NavLink to="/seller" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Store size={24} />
            <span>Sell</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
            <User size={24} />
            <span>Profile</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
