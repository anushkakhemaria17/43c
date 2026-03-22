import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection, query, where, getDocs, addDoc, getDoc, doc, serverTimestamp,
} from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedCustomer = localStorage.getItem('customer');
      if (storedCustomer) {
        try {
          const parsed = JSON.parse(storedCustomer);
          const snap = await getDoc(doc(db, 'customers', parsed.id));
          if (snap.exists()) {
            const fresh = { id: snap.id, ...snap.data() };
            setCustomer(fresh);
            localStorage.setItem('customer', JSON.stringify(fresh));
          } else {
            logout();
          }
        } catch (err) {
          console.error('Session error:', err);
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  /**
   * Check if a mobile number exists in Firestore.
   * Returns { exists: bool, name: string|null }
   */
  const checkMobile = async (mobile) => {
    const q = query(collection(db, 'customers'), where('mobile_number', '==', mobile));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { exists: true, name: snap.docs[0].data().name };
    }
    return { exists: false, name: null };
  };

  /**
   * Log in an existing customer by mobile number.
   */
  const login = async (mobile) => {
    const q = query(collection(db, 'customers'), where('mobile_number', '==', mobile));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Mobile number not found.');
    const docSnap = snap.docs[0];
    const data = { id: docSnap.id, ...docSnap.data() };
    setCustomer(data);
    localStorage.setItem('customer', JSON.stringify(data));
    return data;
  };

  /**
   * Register a new customer with name + mobile.
   * If mobile already exists, logs them in instead.
   */
  const register = async ({ name, mobile }) => {
    const q = query(collection(db, 'customers'), where('mobile_number', '==', mobile));
    const existing = await getDocs(q);
    if (!existing.empty) {
      const docSnap = existing.docs[0];
      const data = { id: docSnap.id, ...docSnap.data() };
      setCustomer(data);
      localStorage.setItem('customer', JSON.stringify(data));
      return data;
    }
    const ref = await addDoc(collection(db, 'customers'), {
      name,
      mobile_number: mobile,
      created_at: serverTimestamp(),
    });
    const newSnap = await getDoc(ref);
    const data = { id: newSnap.id, ...newSnap.data() };
    setCustomer(data);
    localStorage.setItem('customer', JSON.stringify(data));
    return data;
  };

  const logout = () => {
    localStorage.removeItem('customer');
    setCustomer(null);
  };

  const updateProfile = (data) => {
    setCustomer(data);
    localStorage.setItem('customer', JSON.stringify(data));
  };

  return (
    <AuthContext.Provider value={{ customer, loading, checkMobile, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
