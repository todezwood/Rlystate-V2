import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Home, ShoppingBag, Store, LogOut } from 'lucide-react';
import { FeedPage } from './pages/FeedPage';
import { BuyingPage } from './pages/BuyingPage';
import { SellerPage } from './pages/SellerPage';
import { InteractPage } from './pages/InteractPage';
import { useAuth } from './context/AuthContext';
import './index.css';

function App() {
  const { displayName, logout } = useAuth();

  return (
    <BrowserRouter>
      <div className="app-container">
        {/* Identity bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          fontSize: '0.8rem',
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Logged in as <strong style={{ color: 'var(--text-primary)' }}>{displayName}</strong>
          </span>
          <button
            onClick={logout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.8rem',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>

        {/* Main Routed Content Area */}
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/buying" element={<BuyingPage />} />
          <Route path="/seller" element={<SellerPage />} />
          <Route path="/interact/:id" element={<InteractPage />} />
        </Routes>

        {/* Universal Bottom Navigation */}
        <nav className="bottom-nav">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Home size={24} />
            <span>Feed</span>
          </NavLink>
          <NavLink to="/buying" className={({ isActive }) => (isActive ? 'active' : '')}>
            <ShoppingBag size={24} />
            <span>Buying</span>
          </NavLink>
          <NavLink to="/seller" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Store size={24} />
            <span>Sell</span>
          </NavLink>
        </nav>
      </div>
    </BrowserRouter>
  );
}

export default App;
