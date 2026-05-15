import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
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
  checkStatus: async (phone: string) => {
    const { data } = await api.get(`/auth/status/${encodeURIComponent(phone)}`);
    return data;
  }
};
