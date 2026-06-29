import { useEffect, useState } from 'react';
import { Building, Mail, Phone, Save, LogOut, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ErrorState, LoadingState } from '../components/ui/StateDisplays';
import { Card, PageHeader, SectionHeader } from '../components/ui/SharedUI';

export default function Settings() {
  const [formData, setFormData] = useState({
    address: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const { addToast } = useToast();
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const fetchSettings = async () => {
    try {
      setInitialLoading(true);
      setError(null);
      const response = await api.get('/settings');
      if (response.data) {
        setFormData({
          address: response.data.address || '',
          phone: response.data.phone || '',
          email: response.data.email || '',
        });
      }
    } catch (fetchError) {
      console.error('Error fetching settings:', fetchError);
      setError('Unable to load shelter settings right now. Please try again.');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/settings', formData);
      addToast('success', 'Settings saved successfully.');
    } catch (saveError) {
      console.error('Error saving settings:', saveError);
      addToast('error', 'Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      addToast('success', 'Logged out successfully.');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      addToast('error', 'Failed to logout.');
      setLogoutLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
        <LoadingState message="Loading shelter settings..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
        <ErrorState message={error} onRetry={fetchSettings} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
      <PageHeader
        title="Shelter Settings"
        description="Manage the public contact information displayed throughout the CarePaws experience."
      />

      {/* Email Verification Banner */}
      {user && !user.emailVerified && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 mb-1">Email Not Verified</h3>
            <p className="text-sm text-amber-800 mb-3">
              Please verify your email address to ensure you receive important account notifications.
            </p>
            <button
              onClick={() => navigate('/verify-email')}
              className="text-sm font-medium text-amber-600 hover:text-amber-700 underline"
            >
              Verify Email
            </button>
          </div>
        </div>
      )}

      {user && user.emailVerified && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-emerald-900">Email Verified</h3>
            <p className="text-sm text-emerald-800">Your email address has been verified.</p>
          </div>
        </div>
      )}

      <Card noPadding>
        <div className="p-5 border-b border-slate-100 bg-slate-50/60">
          <SectionHeader
            title="Get in Touch Details"
            description="These values appear in public-facing support and contact sections."
          />
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <Building size={16} className="text-emerald-600" />
              Shelter Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
              placeholder="e.g. Happy Paws Shelter, Pampanga"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <Phone size={16} className="text-emerald-600" />
              Contact Number
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
              placeholder="e.g. +63 939 268 3311"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <Mail size={16} className="text-emerald-600" />
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
              placeholder="e.g. info@carepaws.org"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/60 flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Save size={20} />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Card>

      {/* Account Settings Card */}
      <Card noPadding className="mt-6">
        <div className="p-5 border-b border-slate-100 bg-slate-50/60">
          <SectionHeader
            title="Account"
            description="Manage your account settings and security."
          />
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Current Email
            </label>
            <p className="text-slate-600 bg-slate-50 p-3 rounded-lg font-medium">{user?.email}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Account Role
            </label>
            <p className="text-slate-600 bg-slate-50 p-3 rounded-lg font-medium capitalize">{user?.role}</p>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/60 flex justify-end">
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <LogOut size={20} />
            {logoutLoading ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </Card>
    </div>
  );
}
