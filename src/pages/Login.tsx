import { useState } from 'react';
import { PawPrint, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      processSuccessfulLogin(response.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message;
      if (errorMsg?.includes('Too many')) {
        setError('Too many login attempts. Please try again after 15 minutes.');
      } else if (errorMsg?.includes('suspended')) {
        setError('Your account is suspended. Please contact support.');
      } else if (errorMsg?.includes('locked')) {
        setError('Your account is locked. Please contact support.');
      } else {
        setError(errorMsg || 'Failed to login. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError(''); setIsLoading(true);
    try {
      const response = await api.post('/auth/google', { idToken: credentialResponse.credential });
      processSuccessfulLogin(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const processSuccessfulLogin = (data: any) => {
    const { token, user } = data;
    if (!['admin', 'staff', 'super_admin'].includes(user.role)) {
      setError("Access Denied: You do not have staff or admin privileges.");
      return;
    }
    login(token, user);
    navigate('/'); 
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Form Side */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:w-[480px] lg:px-12 xl:px-24 bg-white shadow-2xl z-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <PawPrint className="text-white" size={24} />
            </div>
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">CarePaws</span>
          </div>

          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8 font-medium">Please sign in to access the shelter dashboard.</p>

          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 text-rose-600 mr-3 shrink-0 mt-0.5" />
                <p className="text-sm text-rose-800 font-medium leading-relaxed">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} 
                  className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none transition-all text-sm font-medium" 
                  placeholder="name@shelter.org" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} 
                  className="block w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none transition-all text-sm font-medium" 
                  placeholder="••••••••" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 rounded-xl shadow-md shadow-emerald-500/20 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? 'Signing in...' : 'Sign in to Dashboard'}
            </button>

            <div className="flex items-center justify-between text-sm mt-4">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-slate-500 font-medium text-xs uppercase tracking-wider">Or continue with</span></div>
            </div>
            <div className="flex justify-center px-6">
              <div className="[&>div]:w-full [&>div>div]:w-full">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google authentication failed.")} theme="outline" size="large" width="100%" />
              </div>
            </div>
          </form>
        </div>
      </div>
      
      {/* Right Branding Side (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-1 relative bg-slate-900 overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 opacity-90 z-0"></div>
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03] z-0" style={{ backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        
        <div className="relative z-10 p-12 max-w-lg text-center">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/10">
            <PawPrint className="text-emerald-400" size={40} />
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">Manage shelter operations seamlessly.</h2>
          <p className="text-lg text-emerald-100/70 leading-relaxed font-medium">Review applications, coordinate volunteers, and help animals find their forever homes faster.</p>
        </div>
      </div>
    </div>
  );
}