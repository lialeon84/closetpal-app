import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from '../api/config';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from storage on app start
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        setAuthToken(token);
        const response = await api.get('/auth/me');
        if (response.data.success) {
          setUser(response.data.user);
        }
      }
    } catch (error) {
      console.log('Load user error:', error);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, name) => {
  try {
    console.log('Attempting registration...', { email, name });
    const response = await api.post('/auth/register', {
      email,
      password,
      name,
    });

    console.log('Registration response:', response.data);

    if (response.data.success) {
      const { token, user } = response.data;
      await AsyncStorage.setItem('token', token);
      setAuthToken(token);
      setUser(user);
      return { success: true };
    }
  } catch (error) {
    console.log('Registration error:', error);
    console.log('Error response:', error.response?.data);
    return {
      success: false,
      error: error.response?.data?.error || 'Registration failed',
    };
  }
};

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      if (response.data.success) {
        const { token, user } = response.data;
        await AsyncStorage.setItem('token', token);
        setAuthToken(token);
        setUser(user);
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);