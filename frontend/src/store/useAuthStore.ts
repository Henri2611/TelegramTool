import { create } from 'zustand';
import { authApi } from '../api/auth';

interface AuthState {
  phone: string;
  token: string;
  phoneCodeHash: string;
  step: 'PHONE' | 'OTP' | '2FA' | 'AUTHENTICATED';
  setPhone: (phone: string) => void;
  setToken: (token: string) => void;
  setPhoneCodeHash: (hash: string) => void;
  setStep: (step: 'PHONE' | 'OTP' | '2FA' | 'AUTHENTICATED') => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  phone: localStorage.getItem('tg_phone') || '',
  token: localStorage.getItem('tg_token') || '',
  phoneCodeHash: '',
  step: localStorage.getItem('tg_token') ? 'AUTHENTICATED' : 'PHONE',
  setPhone: (phone) => {
    localStorage.setItem('tg_phone', phone);
    set({ phone });
  },
  setToken: (token) => {
    localStorage.setItem('tg_token', token);
    set({ token });
  },
  setPhoneCodeHash: (phoneCodeHash) => set({ phoneCodeHash }),
  setStep: (step) => set({ step }),
  logout: async () => {
    const { token } = get();
    if (token) {
      try { await authApi.logout(token); } catch { /* ignore */ }
    }
    localStorage.removeItem('tg_phone');
    localStorage.removeItem('tg_token');
    set({ phone: '', token: '', phoneCodeHash: '', step: 'PHONE' });
  },
}));
