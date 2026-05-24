import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

const api = axios.create({
  baseURL: API_BASE,
});

export const authApi = {
  sendCode: async (phone: string) => {
    const { data } = await api.post('/auth/send-code', { phone });
    return data;
  },
  verifyCode: async (phone: string, code: string, phoneCodeHash: string) => {
    const { data } = await api.post('/auth/verify-code', { phone, code, phone_code_hash: phoneCodeHash });
    return data;
  },
  verify2FA: async (phone: string, password: string) => {
    const { data } = await api.post('/auth/2fa', { phone, password });
    return data;
  },
  checkStatus: async (token: string) => {
    const { data } = await api.get('/auth/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },
  logout: async (token: string) => {
    const { data } = await api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  }
};
