// ./frontend/src/api/api.js

import axios from 'axios';

// ── Base URL ──────────────────────────────────────────────────────────────────
// VITE_API_URL must be set in Vercel's environment variables:
//   VITE_API_URL = https://dra-backend-z8sd.onrender.com
// Without it the frontend falls back to localhost — nothing works in production.
const BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,   // always use the versioned prefix
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000, // 90 s — handles Render cold-start (can take ~50 s on free tier)
  withCredentials: false,
});

// ── Request interceptor — attach JWT ─────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle 401 + selective retry ──────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect only when not already on an auth page
      if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/signup')
      ) {
        window.location.href = '/login';
      }
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }

    // Retry 5xx errors — but never for uploads (would double-ingest the file)
    const isUpload = config?.url?.includes('/uploads');
    if (
      config &&
      !isUpload &&
      (!config._retryCount || config._retryCount < 2) &&
      error.response?.status >= 500
    ) {
      config._retryCount = (config._retryCount || 0) + 1;
      await new Promise((r) => setTimeout(r, 1500 * config._retryCount));
      return api(config);
    }

    const message =
      error.response?.data?.message || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const loginUser = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data.data; // { token, user }
};

export const signupUser = async (name, email, password) => {
  const response = await api.post('/auth/signup', {
    name,
    email,
    password,
    passwordConfirm: password,
  });
  return response.data.data;
};

// ── Chat ──────────────────────────────────────────────────────────────────────

export const sendMessage = async (message, sessionId) => {
  const response = await api.post('/chat', { message, sessionId });
  return response.data.data.response;
};

export const fetchChatHistory = async (page = 1, limit = 50, sessionId = null) => {
  const params = { page, limit };
  if (sessionId) params.sessionId = sessionId;
  const response = await api.get('/chat/history', { params });
  return response.data;
};

export const deleteChatById = async (chatId) => {
  const response = await api.delete(`/chat/${chatId}`);
  return response.data;
};

export const deleteChatSession = async (sessionId) => {
  const response = await api.delete(`/chat/session/${sessionId}`);
  return response.data;
};

export const updateChatFeedback = async (chatId, feedback) => {
  const response = await api.patch(`/chat/${chatId}/feedback`, feedback);
  return response.data;
};

// ── Uploads ───────────────────────────────────────────────────────────────────

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/uploads', formData, {
    headers: { 'Content-Type': undefined }, // let browser set multipart boundary
    timeout: 180000, // 3 min — large PDFs + n8n ingestion can be slow
  });
};

export const fetchUploadHistory = async (page = 1, limit = 50) => {
  const response = await api.get('/uploads', { params: { page, limit } });
  return response.data;
};

export const deleteDocument = async (uploadId) => {
  const response = await api.delete(`/uploads/${uploadId}`);
  return response.data;
};

// ── Contact ───────────────────────────────────────────────────────────────────

export const sendContactForm = async (formData) => {
  const response = await api.post('/contact', formData);
  return response.data;
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export const fetchAnalyticsDataApi = async () => {
  const response = await api.get('/analytics');
  return response.data; // { success, data }
};

// ── Health ping — call once on app start to wake Render's free-tier instance ──
export const pingBackend = () => {
  fetch(`${BASE_URL}/health`, { method: 'GET' }).catch(() => {});
};

export default api;