import axios from 'axios';

const api = axios.create({
  // Same-origin by default: the API serves the built app in production, and Vite proxies /api in dev.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('infra_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for auth expiration handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // If unauthorized and not on login page, redirect or clear token
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        localStorage.removeItem('infra_token');
        localStorage.removeItem('infra_user');
        window.location.href = '/login?session_expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
