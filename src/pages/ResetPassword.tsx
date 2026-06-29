import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PawPrint, Lock, AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft, Loader } from 'lucide-react';
import api from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'fair' | 'strong' | null>(null);
  const navigate = useNavigate();

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No reset token found. Please check your email link.');
    } else {
      setStatus('idle');
    }
  }, [token]);

  const calculatePasswordStrength = (password: string) => {
    if (!password) {
      setPasswordStrength(null);
      return;
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;

    const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar, isLongEnough].filter(Boolean).length;

    if (strength <= 2) setPasswordStrength('weak');
    else if (strength <= 3) setPasswordStrength('fair');
    else setPasswordStrength('strong');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setNewPassword(password);
    calculatePasswordStrength(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setStatus('error');
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setStatus('error');
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      setStatus('error');
      setErrorMessage('Password must contain uppercase, lowercase, numbers, and symbols.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword,
      });
      setStatus('success');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(
        error.response?.data?.message ||
        'Password reset failed. Please try again or request a new reset link.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'verifying' && token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <Loader className="animate-spin text-emerald-600 mx-auto mb-4" size={48} />
            <p className="text-slate-600 font-medium">Loading password reset form...</p>
          </div>
        </div>
      </div>
    );
  }

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

          {status === 'success' ? (
            <>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                Password Reset
              </h2>
              <p className="text-slate-500 text-sm mb-8 font-medium">
                Your password has been successfully reset
              </p>

              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-bold text-emerald-900 mb-1">Password updated</h3>
                      <p className="text-sm text-emerald-800">
                        Your password has been changed successfully. You can now login with your new password.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
                >
                  Sign in with new password
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                Set New Password
              </h2>
              <p className="text-slate-500 text-sm mb-8 font-medium">
                Create a strong password for your account
              </p>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {status === 'error' && (
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-rose-800 font-medium">{errorMessage}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={handlePasswordChange}
                      className="block w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none transition-all text-sm font-medium"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        <div className={`h-2 flex-1 rounded-full ${passwordStrength === 'weak' || passwordStrength === 'fair' || passwordStrength === 'strong' ? 'bg-rose-500' : 'bg-slate-200'}`}></div>
                        <div className={`h-2 flex-1 rounded-full ${passwordStrength === 'fair' || passwordStrength === 'strong' ? 'bg-amber-500' : 'bg-slate-200'}`}></div>
                        <div className={`h-2 flex-1 rounded-full ${passwordStrength === 'strong' ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                      </div>
                      <p className={`text-xs font-medium ${passwordStrength === 'strong' ? 'text-emerald-600' : passwordStrength === 'fair' ? 'text-amber-600' : 'text-rose-600'}`}>
                        {passwordStrength === 'strong' ? 'Strong password' : passwordStrength === 'fair' ? 'Fair password' : 'Weak password'}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 mt-2">
                    Must contain uppercase, lowercase, numbers, and symbols (8+ chars)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none transition-all text-sm font-medium"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 rounded-xl shadow-md shadow-emerald-500/20 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Resetting password...' : 'Reset Password'}
                </button>
              </form>
            </>
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
            Secure Password Reset
          </h2>
          <p className="text-lg text-emerald-100/70 leading-relaxed font-medium">
            Create a strong password to protect your shelter management account.
          </p>
        </div>
      </div>
    </div>
  );
}
