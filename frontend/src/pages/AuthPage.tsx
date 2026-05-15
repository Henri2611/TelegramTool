import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../api/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const { step, phone, phoneCodeHash, setPhone, setPhoneCodeHash, setStep, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Local states for inputs
  const [inputPhone, setInputPhone] = useState(phone || '');
  const [inputCode, setInputCode] = useState('');
  const [inputPassword, setInputPassword] = useState('');

  // Check auth status on mount if we think we are authenticated
  useEffect(() => {
    const checkAuth = async () => {
      if (step === 'AUTHENTICATED' && phone) {
        try {
          const res = await authApi.checkStatus(phone);
          if (res.is_authorized) {
            navigate('/dashboard');
          } else {
            logout();
          }
        } catch (error) {
          logout();
        }
      }
    };
    checkAuth();
  }, [step, phone, navigate, logout]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPhone) return toast.error('Please enter phone number');
    
    setLoading(true);
    try {
      const res = await authApi.sendCode(inputPhone);
      if (res.message === 'Already authorized') {
        setPhone(inputPhone);
        setStep('AUTHENTICATED');
        navigate('/dashboard');
        toast.success('Successfully logged in!');
      } else {
        setPhone(inputPhone);
        setPhoneCodeHash(res.phone_code_hash);
        setStep('OTP');
        toast.success('Code sent to your Telegram app');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode) return toast.error('Please enter the code');
    
    setLoading(true);
    try {
      const res = await authApi.verifyCode(phone, inputCode, phoneCodeHash);
      if (res.requires_2fa) {
        setStep('2FA');
        toast.info('2FA Password required');
      } else {
        setStep('AUTHENTICATED');
        navigate('/dashboard');
        toast.success('Successfully logged in!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword) return toast.error('Please enter your password');
    
    setLoading(true);
    try {
      await authApi.verify2FA(phone, inputPassword);
      setStep('AUTHENTICATED');
      navigate('/dashboard');
      toast.success('Successfully logged in!');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Telegram Login</CardTitle>
          <CardDescription>
            {step === 'PHONE' && "Enter your phone number to continue."}
            {step === 'OTP' && `Enter the code sent to ${phone}`}
            {step === '2FA' && "Enter your Cloud Password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'PHONE' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <Input
                placeholder="Phone (e.g. +1234567890)"
                value={inputPhone}
                onChange={(e) => setInputPhone(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Code'}
              </Button>
            </form>
          )}

          {step === 'OTP' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <Input
                placeholder="00000"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>
            </form>
          )}

          {step === '2FA' && (
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <Input
                type="password"
                placeholder="Password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Submit Password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
