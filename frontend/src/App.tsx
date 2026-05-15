import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import { useAuthStore } from './store/useAuthStore';

function App() {
  const { step } = useAuthStore();
  
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<Navigate to={step === 'AUTHENTICATED' ? "/dashboard" : "/auth"} />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={
          step === 'AUTHENTICATED' ? <DashboardPage /> : <Navigate to="/auth" />
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
