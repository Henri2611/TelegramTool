import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import { useAuthStore } from './store/useAuthStore';
import { authApi } from './api/auth';

function App() {
  const { step, token, logout } = useAuthStore();
  const { theme } = useTheme();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (step === 'AUTHENTICATED' && token) {
        try {
          const res = await authApi.checkStatus(token);
          if (!res.is_authorized) {
            await logout();
          }
        } catch {
          await logout();
        }
      }
      setChecking(false);
    };
    check();
  }, []);

  if (checking) return null;

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        richColors
        theme={theme === 'dark' ? 'dark' : 'light'}
      />
      <Routes>
        <Route path="/" element={<Navigate to={step === 'AUTHENTICATED' ? '/dashboard' : '/auth'} />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={
          step === 'AUTHENTICATED' ? <DashboardPage /> : <Navigate to="/auth" />
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;