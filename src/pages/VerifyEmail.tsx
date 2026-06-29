import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PawPrint, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import api from '../services/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('No verification token found. Please check your email link.');
        return;
      }

      try {
        await api.post('/auth/verify-email', { token });
        setStatus('success');
        setMessage('Email verified successfully! Redirecting to login...');
        
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (error: any) {
        setStatus('error');
        setMessage(
          error.response?.data?.message || 
          'Email verification failed. Token may have expired. Please request a new verification email.'
        );
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <PawPrint className="text-emerald-600" size={32} />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">
            Email Verification
          </h1>
          <p className="text-center text-slate-500 mb-8">
            Securing your CarePaws account
          </p>

          {/* Status Content */}
          <div className="space-y-6">
            {status === 'loading' && (
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <Loader className="animate-spin text-emerald-600" size={48} />
                </div>
                <p className="text-slate-600 font-medium">Verifying your email address...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-emerald-100 rounded-full p-3">
                    <CheckCircle className="text-emerald-600" size={48} />
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-emerald-800 font-medium text-center">{message}</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-rose-100 rounded-full p-3">
                    <AlertCircle className="text-rose-600" size={48} />
                  </div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                  <p className="text-rose-800 font-medium text-center">{message}</p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-center text-sm text-slate-500">
              Need help? Contact support at support@carepaws.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
