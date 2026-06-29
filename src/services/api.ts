import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://lykasserver.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Globally handle 401 Unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      window.dispatchEvent(new CustomEvent('admin:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// Admin Password Reset - sends reset email to user
export const sendUserPasswordReset = async (userId: string) => {
  const response = await api.post(`/auth/admin/force-reset/${userId}`);
  return response.data;
};

export default api;
