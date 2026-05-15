import { create } from 'zustand';

interface AuthState {
  phone: string;
  phoneCodeHash: string;
  step: 'PHONE' | 'OTP' | '2FA' | 'AUTHENTICATED';
  setPhone: (phone: string) => void;
  setPhoneCodeHash: (hash: string) => void;
  setStep: (step: 'PHONE' | 'OTP' | '2FA' | 'AUTHENTICATED') => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  phone: localStorage.getItem('tg_phone') || '',
  phoneCodeHash: '',
  step: localStorage.getItem('tg_phone') ? 'AUTHENTICATED' : 'PHONE', // Simple persistence for now
  setPhone: (phone) => {
    localStorage.setItem('tg_phone', phone);
    set({ phone });
  },
  setPhoneCodeHash: (phoneCodeHash) => set({ phoneCodeHash }),
  setStep: (step) => set({ step }),
  logout: () => {
    localStorage.removeItem('tg_phone');
    set({ phone: '', phoneCodeHash: '', step: 'PHONE' });
  },
}));
