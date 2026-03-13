import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          // Fetch latest profile to sync membership status
          const res = await api.get('customers/profile/');
          setCustomer(res.data);
          localStorage.setItem('customer', JSON.stringify(res.data));
        } catch (err) {
          console.error("Session expired or invalid");
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (mobile) => {
    const res = await api.post('customers/login/', { mobile });
    localStorage.setItem('access_token', res.data.access);
    localStorage.setItem('refresh_token', res.data.refresh);
    localStorage.setItem('customer', JSON.stringify(res.data.customer));
    setCustomer(res.data.customer);
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post('customers/register/', data);
    localStorage.setItem('access_token', res.data.access);
    localStorage.setItem('refresh_token', res.data.refresh);
    localStorage.setItem('customer', JSON.stringify(res.data.customer));
    setCustomer(res.data.customer);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('customer');
    setCustomer(null);
  };

  const updateProfile = (data) => {
    setCustomer(data);
    localStorage.setItem('customer', JSON.stringify(data));
  };

  return (
    <AuthContext.Provider value={{ customer, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
