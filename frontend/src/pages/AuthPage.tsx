import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../api/auth';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { getErrorMessage } from '../lib/utils';
import { Moon, Sun, ArrowLeft, Smartphone, ShieldCheck, Check } from 'lucide-react';

// ── OTP 5-box input ──────────────────────────────────────────────────────────

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const len = 5;
  const chars = Array.from({ length: len }, (_, i) => value[i] || '');

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      const next = [...chars];
      next[i] = '';
      onChange(next.join(''));
      return;
    }
    const c = raw.slice(-1);
    const next = [...chars];
    next[i] = c;
    onChange(next.join(''));
    if (i < len - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[i] && i > 0) {
      const next = [...chars];
      next[i - 1] = '';
      onChange(next.join(''));
      refs.current[i - 1]?.focus();
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < len - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, len);
    const next = Array.from({ length: len }, (_, i) => text[i] || '');
    onChange(next.join('').trimEnd());
    refs.current[Math.min(text.length, len - 1)]?.focus();
  };

  return (
    <div className="flex gap-2">
      {Array.from({ length: len }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={chars[i]}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoFocus={i === 0}
          placeholder="·"
          className={[
            'flex-1 h-11 text-center text-lg font-bold rounded-lg border-2 outline-none',
            'transition-all duration-150 bg-background text-foreground placeholder:text-muted-foreground/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            chars[i]
              ? 'border-primary bg-primary/5'
              : 'border-input hover:border-muted-foreground/40',
            'focus:border-primary focus:ring-4 focus:ring-primary/15',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

// ── Step track ───────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'PHONE', label: 'Phone' },
  { key: 'OTP',   label: 'Verify' },
  { key: '2FA',   label: 'Sign in' },
] as const;

function StepTrack({ step }: { step: 'PHONE' | 'OTP' | '2FA' }) {
  const currentIdx = STEPS.findIndex((s) => s.key === step);
  return (
    <div className="flex items-start gap-0 mb-10">
      {STEPS.map((s, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-start flex-1">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                  done   ? 'bg-primary text-primary-foreground' : '',
                  active ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : '',
                  !done && !active ? 'bg-muted text-muted-foreground' : '',
                ].join(' ')}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium transition-colors ${
                  active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px flex-1 mx-2 mt-3.5 transition-all duration-500 ${
                  i < currentIdx ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Spinner helper ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Telegram wordmark SVG ────────────────────────────────────────────────────

function TgMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.2-.04-.28-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.25.38-.51 1.07-.78 4.19-1.82 6.98-3.02 8.38-3.61 3.99-1.66 4.82-1.95 5.36-1.96.12 0 .38.03.55.17.14.12.18.28.2.45-.02.07-.02.14-.04.23z" />
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AuthPage() {
  const {
    step, phone, token, phoneCodeHash,
    setPhone, setToken, setPhoneCodeHash, setStep, logout,
  } = useAuthStore();

  const [loading,       setLoading]       = useState(false);
  const [cooldown,      setCooldown]      = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [inputPhone,    setInputPhone]    = useState(phone || '');
  const [inputCode,     setInputCode]     = useState('');
  const [inputPassword, setInputPassword] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (step !== 'AUTHENTICATED' || !token) return;
    authApi.checkStatus(token)
      .then((res) => (res.is_authorized ? navigate('/dashboard') : logout()))
      .catch(() => logout());
  }, [step, token, navigate, logout]);

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPhone) return toast.error('Enter your phone number');
    if (cooldown > 0) return;
    setLoading(true);
    try {
      const res = await authApi.sendCode(inputPhone);
      if (res.message === 'Already authorized') {
        if (res.token) setToken(res.token);
        setPhone(inputPhone);
        setStep('AUTHENTICATED');
        navigate('/dashboard');
        toast.success('Welcome back!');
      } else {
        setPhone(inputPhone);
        setPhoneCodeHash(res.phone_code_hash);
        setStep('OTP');
        setCooldown(30);
        toast.success('Code sent to your Telegram app');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send code'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.replace(/\D/g, '').length < 5) return toast.error('Enter the 5-digit code');
    setLoading(true);
    try {
      const res = await authApi.verifyCode(phone, inputCode, phoneCodeHash);
      if (res.token) {
        setToken(res.token);
        setStep('AUTHENTICATED');
        navigate('/dashboard');
        toast.success('Logged in successfully');
      } else if (res.requires_2fa) {
        setStep('2FA');
        toast.info('2FA password required');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Invalid code'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword) return toast.error('Enter your cloud password');
    setLoading(true);
    try {
      const res = await authApi.verify2FA(phone, inputPassword);
      if (res.token) {
        setToken(res.token);
        setStep('AUTHENTICATED');
        navigate('/dashboard');
        toast.success('Logged in successfully');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Wrong password'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'OTP')  { setStep('PHONE'); setInputCode(''); }
    if (step === '2FA')  { setStep('OTP');   setInputPassword(''); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Hero panel ────────────────────────────────────────────────────── */}
      <div
        className="relative w-full md:w-[46%] flex flex-col overflow-hidden"
        style={{
          background:
            'linear-gradient(145deg, var(--brand-from) 0%, var(--brand-via) 55%, var(--brand-to) 100%)',
        }}
      >
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-black/15 blur-3xl" />
        </div>

        {/* Mobile: compact strip */}
        <div className="relative z-10 flex md:hidden items-center gap-3 px-5 py-4">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <TgMark className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Telegram Manager</p>
            <p className="text-white/50 text-[10px]">Clean up your chats</p>
          </div>
        </div>

        {/* Desktop: full hero */}
        <div className="relative z-10 hidden md:flex flex-col justify-between flex-1 p-12 pb-10">
          {/* Wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <TgMark className="w-5 h-5 text-white" />
            </div>
            <span className="text-white/75 text-sm font-medium tracking-wide">Telegram Manager</span>
          </div>

          {/* Statement */}
          <div>
            <h1 className="text-[3.25rem] font-bold leading-[1.08] text-white mb-5 tracking-tight">
              Your groups.<br />
              <span className="text-white/45">Your rules.</span>
            </h1>
            <p className="text-white/65 text-base leading-relaxed max-w-[22rem] mb-10">
              Stop drowning in irrelevant chats. View, filter, and mass-leave Telegram groups in minutes.
            </p>

            <ul className="space-y-3">
              {[
                'Connect securely with your phone number',
                'Browse all your groups and channels',
                'Bulk-leave with one click — no bot required',
              ].map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-white/70 text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-white/25 text-xs">Not affiliated with Telegram Messenger.</p>
        </div>
      </div>

      {/* ── Form panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10 relative bg-background">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="absolute top-5 right-5 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-full max-w-[360px]">
          {/* Step track — only show during active auth steps */}
          {(step === 'PHONE' || step === 'OTP' || step === '2FA') && (
            <StepTrack step={step} />
          )}

          {step !== 'PHONE' && (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}

          <AnimatePresence mode="wait">

            {/* ── Phone step ─────────────────────────────────────────────── */}
            {step === 'PHONE' && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                <div className="mb-7">
                  <h2 className="text-2xl font-bold mb-1.5">Sign in to Telegram</h2>
                  <p className="text-muted-foreground text-sm">
                    We'll send a verification code to your Telegram app.
                  </p>
                </div>

                <form onSubmit={handleSendCode} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Phone number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="+1 234 567 8900"
                        className="pl-9 h-11"
                        value={inputPhone}
                        onChange={(e) => setInputPhone(e.target.value)}
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={loading || cooldown > 0}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2"><Spinner /> Sending…</span>
                    ) : cooldown > 0 ? (
                      `Resend in ${cooldown}s`
                    ) : (
                      'Send Code'
                    )}
                  </Button>
                </form>
              </motion.div>
            )}

            {/* ── OTP step ───────────────────────────────────────────────── */}
            {step === 'OTP' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                <div className="mb-7">
                  <h2 className="text-2xl font-bold mb-1.5">Check Telegram</h2>
                  <p className="text-muted-foreground text-sm">
                    We sent a 5-digit code to{' '}
                    <span className="font-semibold text-foreground">{phone}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Verification code</label>
                    <OtpInput value={inputCode} onChange={setInputCode} disabled={loading} />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={loading || inputCode.replace(/\D/g, '').length < 5}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2"><Spinner /> Verifying…</span>
                    ) : (
                      'Verify Code'
                    )}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    {cooldown > 0 ? (
                      <>
                        Resend available in{' '}
                        <span className="font-mono font-semibold tabular-nums">{cooldown}s</span>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setStep('PHONE'); setCooldown(0); }}
                        className="text-primary hover:underline"
                      >
                        Resend code
                      </button>
                    )}
                  </p>
                </form>
              </motion.div>
            )}

            {/* ── 2FA step ───────────────────────────────────────────────── */}
            {step === '2FA' && (
              <motion.div
                key="2fa"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                <div className="mb-7">
                  <h2 className="text-2xl font-bold mb-1.5">Two-factor auth</h2>
                  <p className="text-muted-foreground text-sm">
                    Your account has 2FA enabled. Enter your Telegram cloud password.
                  </p>
                </div>

                <form onSubmit={handleVerify2FA} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Cloud password</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Your password"
                        className="pl-9 h-11"
                        value={inputPassword}
                        onChange={(e) => setInputPassword(e.target.value)}
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={loading || !inputPassword}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2"><Spinner /> Signing in…</span>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
