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
import { MessageCircle, Send, Moon, Sun, ShieldCheck, ArrowLeft, Smartphone, KeyRound } from 'lucide-react';

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            i <= current ? 'bg-primary' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  );
}

function LoginForm({
  onSubmit,
  placeholder,
  type,
  label,
  buttonText,
  loading,
  icon: Icon,
  value,
  onChange,
}: {
  onSubmit: (e: React.FormEvent) => void;
  placeholder: string;
  type?: string;
  label: string;
  buttonText: string;
  loading: boolean;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <div className="relative">
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type={type || 'text'}
            placeholder={placeholder}
            className="pl-10 h-11"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </div>
      </div>
      <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </span>
        ) : (
          buttonText
        )}
      </Button>
    </form>
  );
}

export default function AuthPage() {
  const { step, phone, token, phoneCodeHash, setPhone, setToken, setPhoneCodeHash, setStep, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [inputPhone, setInputPhone] = useState(phone || '');
  const [inputCode, setInputCode] = useState('');
  const [inputPassword, setInputPassword] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      if (step === 'AUTHENTICATED' && token) {
        try {
          const res = await authApi.checkStatus(token);
          if (res.is_authorized) {
            navigate('/dashboard');
          } else {
            logout();
          }
        } catch { logout(); }
      }
    };
    checkAuth();
  }, [step, token, navigate, logout]);

  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown > 0]);

  const stepIndex = step === 'PHONE' ? 0 : step === 'OTP' ? 1 : 2;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPhone) return toast.error('Please enter your phone number');
    if (cooldown > 0) return;

    setLoading(true);
    try {
      const res = await authApi.sendCode(inputPhone);
      console.log('sendCode response:', res);
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
      const msg = getErrorMessage(err, 'Failed to send code');
      console.error('sendCode error:', err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode) return toast.error('Please enter the verification code');

    setLoading(true);
    try {
      const res = await authApi.verifyCode(phone, inputCode, phoneCodeHash);
      if (res.token) {
        setToken(res.token);
        setStep('AUTHENTICATED');
        navigate('/dashboard');
        toast.success('Successfully logged in!');
      } else if (res.requires_2fa) {
        setStep('2FA');
        toast.info('2FA password required');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Invalid verification code'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword) return toast.error('Please enter your cloud password');

    setLoading(true);
    try {
      const res = await authApi.verify2FA(phone, inputPassword);
      if (res.token) {
        setToken(res.token);
        setStep('AUTHENTICATED');
        navigate('/dashboard');
        toast.success('Successfully logged in!');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Invalid password'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'OTP') setStep('PHONE');
    else if (step === '2FA') setStep('OTP');
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 dark:from-primary dark:via-primary dark:to-primary/60">
        <div className="absolute inset-0 bg-black/40 dark:bg-black/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.3),transparent_50%)]" />
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
          <div className="mb-8">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <MessageCircle className="w-10 h-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 text-center">Telegram Manager</h1>
          <p className="text-sm text-white/60 mb-6 text-center">Not affiliated with Telegram</p>
          <p className="text-lg text-white/80 text-center max-w-md leading-relaxed">
            Manage your Telegram groups and channels efficiently. Bulk leave, organize, and clean up your chat list with ease.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6 w-full max-w-sm">
            {[
              { icon: Smartphone, label: 'Secure Login' },
              { icon: ShieldCheck, label: 'Safe & Private' },
              { icon: Send, label: 'Bulk Actions' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs text-white/70">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="absolute top-6 right-6 p-2 rounded-lg hover:bg-muted transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Telegram Manager</h2>
              <p className="text-xs text-muted-foreground">Not affiliated with Telegram</p>
            </div>
          </div>

          <StepIndicator current={stepIndex} total={3} />

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
            {step === 'PHONE' && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-2">Welcome back</h2>
                  <p className="text-muted-foreground">Enter your phone number to continue.</p>
                </div>
                <LoginForm
                  onSubmit={handleSendCode}
                  placeholder="+1 234 567 890"
                  label="Phone Number"
                  buttonText={cooldown > 0 ? `Resend in ${cooldown}s` : "Send Code"}
                  loading={loading}
                  icon={Smartphone}
                  value={inputPhone}
                  onChange={setInputPhone}
                />
              </motion.div>
            )}

            {step === 'OTP' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-2">Check your Telegram</h2>
                  <p className="text-muted-foreground">
                    We sent a code to <span className="font-medium text-foreground">{phone}</span>
                  </p>
                </div>
                <LoginForm
                  onSubmit={handleVerifyCode}
                  placeholder="00 000"
                  label="Verification Code"
                  buttonText="Verify Code"
                  loading={loading}
                  icon={KeyRound}
                  value={inputCode}
                  onChange={setInputCode}
                />
              </motion.div>
            )}

            {step === '2FA' && (
              <motion.div
                key="2fa"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-2">Cloud Password</h2>
                  <p className="text-muted-foreground">
                    Enter your Telegram two-factor authentication password.
                  </p>
                </div>
                <LoginForm
                  onSubmit={handleVerify2FA}
                  placeholder="Your password"
                  type="password"
                  label="Password"
                  buttonText="Sign In"
                  loading={loading}
                  icon={ShieldCheck}
                  value={inputPassword}
                  onChange={setInputPassword}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
