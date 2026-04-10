import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Search, ShoppingBag, Store, User } from 'lucide-react';
import { SearchPage } from './pages/SearchPage';
import { BuyingPage } from './pages/BuyingPage';
import { SellerPage } from './pages/SellerPage';
import { ProfilePage } from './pages/ProfilePage';
import { InteractPage } from './pages/InteractPage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/buying" element={<BuyingPage />} />
          <Route path="/seller" element={<SellerPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/interact/:id" element={<InteractPage />} />
        </Routes>

        <nav className="bottom-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
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
      </div>
    </BrowserRouter>
  );
}

export default App;
