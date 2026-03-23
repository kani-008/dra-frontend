// ./frontend/src/context/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { pingBackend } from '../api/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                         = useState(null);
  const [token, setToken]                       = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [isAuthenticated, setIsAuthenticated]   = useState(false);

  useEffect(() => {
    // ── Wake up the Render backend immediately on app load ──────────────────
    // Render's free tier spins down after ~15 min of inactivity.
    // The first real request after a cold start can take 30-50 s and time out.
    // Sending a /health ping here starts the wake-up cycle while the user is
    // still reading the page, so by the time they log in the server is ready.
    pingBackend();

    // ── Restore session from localStorage ────────────────────────────────────
    // Only the JWT token and a minimal user profile are stored locally.
    // All application data (chats, documents) is fetched from MongoDB via API.
    const storedToken = localStorage.getItem('token');
    const storedUser  = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    setLoading(false);
  }, []);

  const login = (authToken, userData) => {
    if (!authToken) return;
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, isAuthenticated }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};