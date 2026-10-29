import { create } from 'zustand';
import { authApi } from '../api/auth';

type Step = 'PHONE' | 'OTP' | '2FA' | 'AUTHENTICATED';

interface AuthState {
  phone: string;
  token: string;
  phoneCodeHash: string;
  step: Step;
  setPhone: (phone: string) => void;
  setToken: (token: string) => void;
  setPhoneCodeHash: (hash: string) => void;
  setStep: (step: Step) => void;
  logout: () => Promise<void>;
}

function getInitialStep(): Step {
  if (localStorage.getItem('tg_token')) return 'AUTHENTICATED';
  const s = localStorage.getItem('tg_step') as Step | null;
  if (s === 'OTP' || s === '2FA') return s;
  return 'PHONE';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  phone:         localStorage.getItem('tg_phone')     || '',
  token:         localStorage.getItem('tg_token')     || '',
  phoneCodeHash: localStorage.getItem('tg_code_hash') || '',
  step:          getInitialStep(),

  setPhone: (phone) => {
    localStorage.setItem('tg_phone', phone);
    set({ phone });
  },
  setToken: (token) => {
    localStorage.setItem('tg_token', token);
    set({ token });
  },
  setPhoneCodeHash: (phoneCodeHash) => {
    if (phoneCodeHash) {
      localStorage.setItem('tg_code_hash', phoneCodeHash);
    } else {
      localStorage.removeItem('tg_code_hash');
    }
    set({ phoneCodeHash });
  },
  setStep: (step) => {
    // Only persist the in-progress OTP/2FA steps — PHONE and AUTHENTICATED
    // don't need to survive a refresh (AUTHENTICATED is handled by tg_token).
    if (step === 'OTP' || step === '2FA') {
      localStorage.setItem('tg_step', step);
    } else {
      localStorage.removeItem('tg_step');
    }
    set({ step });
  },
  logout: async () => {
    const { token } = get();
    if (token) {
      try { await authApi.logout(token); } catch { /* ignore */ }
    }
    localStorage.removeItem('tg_phone');
    localStorage.removeItem('tg_token');
    localStorage.removeItem('tg_step');
    localStorage.removeItem('tg_code_hash');
    set({ phone: '', token: '', phoneCodeHash: '', step: 'PHONE' });
  },
}));
