import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { PawPrint, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus('submitting');

    try {
      await api.post('/auth/forgot-password', { email });
      setStatus('success');
      setEmail('');
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(
        error.response?.data?.message || 
        'An error occurred. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Form Side */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:w-[480px] lg:px-12 xl:px-24 bg-white shadow-2xl z-10">
        <div className="mx-auto w-full max-w-sm">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium mb-8 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Login
          </button>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <PawPrint className="text-white" size={24} />
            </div>
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">CarePaws</span>
          </div>

          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Forgot your password?
          </h2>
          <p className="text-slate-500 text-sm mb-8 font-medium">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {status === 'success' ? (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-bold text-emerald-900 mb-1">Check your email</h3>
                    <p className="text-sm text-emerald-800">
                      If an account exists with this email, you'll receive a password reset link shortly.
                      The link will expire in 1 hour.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {status === 'error' && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-rose-800 font-medium">{errorMessage}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none transition-all text-sm font-medium"
                    placeholder="name@shelter.org"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 rounded-xl shadow-md shadow-emerald-500/20 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending reset link...' : 'Send Reset Link'}
              </button>

              <p className="text-center text-xs text-slate-500 font-medium">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Right Branding Side */}
      <div className="hidden lg:flex flex-1 relative bg-slate-900 overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 opacity-90 z-0"></div>
        <div className="absolute inset-0 opacity-[0.03] z-0" style={{ backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>

        <div className="relative z-10 p-12 max-w-lg text-center">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/10">
            <PawPrint className="text-emerald-400" size={40} />
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
            Secure Account Recovery
          </h2>
          <p className="text-lg text-emerald-100/70 leading-relaxed font-medium">
            We'll help you regain access to your shelter management account safely and securely.
          </p>
        </div>
      </div>
    </div>
  );
}
