import { Bell, Send, Users, Clock, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, PageHeader, StatCard, Badge } from '../components/ui/SharedUI';
import { LoadingState, ErrorState } from '../components/ui/StateDisplays';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const categoryColors: Record<string, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
  APPLICATION_APPROVED: 'success', APPLICATION_REJECTED: 'danger',
  INTERVIEW_SCHEDULED: 'info', HOME_VISIT_SCHEDULED: 'info',
  FOSTER_STARTED: 'warning', PAYMENT_RECEIVED: 'success',
  GENERAL: 'default',
};

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsAdmin() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [filter, setFilter]               = useState('all');
  const [showCreate, setShowCreate]       = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [form, setForm]                   = useState({ recipientId: 'all', title: '', message: '', type: 'GENERAL' });
  const { addToast } = useToast();

  const fetchNotifications = async () => {
    try {
      setLoading(true); setError(null);
      const res = await api.get('/notifications/admin?limit=50');
      setNotifications(res.data.notifications || res.data || []);
    } catch (e: any) {
      setError('Could not load notifications.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleSend = async () => {
    if (!form.title || !form.message) { addToast('error', 'Title and message are required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/notifications/send', form);
      addToast('success', form.recipientId === 'all' ? 'Broadcast sent to all users.' : 'Notification sent.');
      setShowCreate(false);
      setForm({ recipientId: 'all', title: '', message: '', type: 'GENERAL' });
      fetchNotifications();
    } catch (e: any) {
      addToast('error', e.response?.data?.message || 'Could not send.');
    } finally { setSubmitting(false); }
  };

  const filtered = filter === 'all' ? notifications
    : notifications.filter(n => n.type?.toLowerCase().includes(filter) || n.isRead === (filter === 'read'));

  const sent      = notifications.length;
  const unread    = notifications.filter(n => !n.isRead).length;
  const types     = [...new Set(notifications.map(n => n.type))];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Notifications Management"
        description="View system-generated notifications and broadcast messages to users."
        action={
          <button onClick={() => setShowCreate(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">
            <Plus size={18} /> New Notification
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Send         size={24} />} label="Total Sent"    value={sent.toString()}          tone="emerald" />
        <StatCard icon={<Clock        size={24} />} label="Unread"        value={unread.toString()}         tone="amber" />
        <StatCard icon={<Users        size={24} />} label="Types"         value={types.length.toString()}   tone="blue" />
        <StatCard icon={<AlertCircle  size={24} />} label="Read"          value={(sent - unread).toString()} tone="slate" />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'unread', 'read'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === s ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <LoadingState message="Loading notifications..." />
        : error ? <ErrorState message={error} onRetry={fetchNotifications} />
        : filtered.length === 0 ? (
          <Card className="text-center py-12">
            <Bell size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No notifications found</p>
          </Card>
        ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map(n => (
            <Card key={n._id} noPadding className="overflow-hidden">
              <div className="p-5 flex items-start gap-4">
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${n.isRead ? 'bg-slate-100' : 'bg-emerald-100'}`}>
                  {n.isRead
                    ? <CheckCircle2 size={24} className="text-slate-400" />
                    : <Bell         size={24} className="text-emerald-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-bold text-slate-800">{n.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                    </div>
                    <Badge variant={categoryColors[n.type] || 'default'}>{n.type?.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-3">
                    <span>👤 {n.recipient?.displayName || n.recipient?.email || 'User'}</span>
                    {n.sender && <span>📤 from {n.sender?.displayName || 'System'}</span>}
                    <span>🕐 {timeAgo(n.createdAt)}</span>
                    <Badge variant={n.isRead ? 'default' : 'info'}>{n.isRead ? 'Read' : 'Unread'}</Badge>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Send Notification</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Recipients</label>
                <select value={form.recipientId} onChange={e => setForm(f => ({ ...f, recipientId: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="all">All Users (Broadcast)</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">To send to a specific user, enter their User ID.</p>
                {form.recipientId !== 'all' && (
                  <input type="text" value={form.recipientId} onChange={e => setForm(f => ({ ...f, recipientId: e.target.value }))}
                    placeholder="Enter user ID..." className="w-full p-2 border border-slate-200 rounded-lg text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Notification title" className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Message *</label>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4}
                  placeholder="Message content" className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button onClick={handleSend} disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                  <Send size={16} /> {submitting ? 'Sending...' : 'Send Now'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
