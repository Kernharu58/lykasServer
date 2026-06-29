import { CalendarDays, Download, MapPin, Plus, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Card, PageHeader, SectionHeader, StatCard } from '../components/ui/SharedUI';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/StateDisplays';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const typeTone: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  'Adoption Drive': 'success', Training: 'info', Community: 'warning',
  Fundraiser: 'info', Volunteer: 'default', Other: 'default',
};

const statusTone: Record<string, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
  upcoming: 'info', ongoing: 'success', completed: 'default', cancelled: 'danger',
};

export default function Events() {
  const [events, setEvents]             = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [form, setForm]                 = useState({ title: '', description: '', category: 'Adoption Drive', date: '', location: '', maxAttendees: '' });
  const { addToast } = useToast();

  const fetchEvents = async () => {
    try {
      setLoading(true); setError(null);
      const res = await api.get('/events?limit=50');
      setEvents(res.data.events || res.data);
    } catch (e: any) {
      setError('Could not load events.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleCreate = async () => {
    if (!form.title || !form.date) { addToast('error', 'Title and date are required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/events', { ...form, maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null });
      addToast('success', `Event "${form.title}" created.`);
      setShowCreate(false);
      setForm({ title: '', description: '', category: 'Adoption Drive', date: '', location: '', maxAttendees: '' });
      fetchEvents();
    } catch (e: any) {
      addToast('error', e.response?.data?.message || 'Could not create event.');
    } finally { setSubmitting(false); }
  };

  const handleCancel = async (id: string, title: string) => {
    if (!window.confirm(`Cancel "${title}"?`)) return;
    try {
      await api.delete(`/events/${id}`);
      addToast('success', `"${title}" cancelled.`);
      fetchEvents();
    } catch (e: any) {
      addToast('error', e.response?.data?.message || 'Could not cancel event.');
    }
  };

  const upcoming   = events.filter(e => e.status === 'upcoming').length;
  const openSlots  = events.reduce((acc, e) => acc + Math.max(0, (e.maxAttendees || 0) - (e.currentAttendees || 0)), 0);
  const totalRSVPs = events.reduce((acc, e) => acc + (e.currentAttendees || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Events"
        description="Plan adoption drives, training sessions, volunteer coverage, and public RSVP capacity."
        action={
          <button onClick={() => setShowCreate(true)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">
            <Plus size={18} /> Create Event
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={<CalendarDays size={24} />} label="Upcoming Events"      value={upcoming.toString()}   tone="emerald" />
        <StatCard icon={<Users        size={24} />} label="Open Volunteer Slots" value={openSlots.toString()}  tone="amber" />
        <StatCard icon={<Download     size={24} />} label="Registered Attendees" value={totalRSVPs.toString()} tone="blue" />
      </div>

      <Card noPadding>
        <div className="p-5 border-b border-slate-100 bg-slate-50/70">
          <SectionHeader title="Event Calendar" description="Live data from the shelter system." />
        </div>

        {error ? <div className="p-6"><ErrorState message={error} onRetry={fetchEvents} /></div>
          : loading ? <div className="p-6"><LoadingState message="Loading events..." /></div>
          : events.length === 0 ? <div className="p-6"><EmptyState title="No events yet" message="Create your first event using the button above." /></div>
          : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5 sm:p-6">
            {events.map(event => (
              <article key={event._id} className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-emerald-700 via-teal-700 to-slate-800 p-4 text-white flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <Badge variant={typeTone[event.category] || 'default'}>{event.category}</Badge>
                    <Badge variant={statusTone[event.status] || 'default'}>{event.status}</Badge>
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight">{event.title}</h3>
                </div>
                <div className="p-4 space-y-3">
                  <p className="flex items-center gap-2 text-sm text-slate-600"><CalendarDays size={16} className="text-emerald-700" />{new Date(event.date).toLocaleDateString()}</p>
                  {event.location && <p className="flex items-center gap-2 text-sm text-slate-600"><MapPin size={16} className="text-emerald-700" />{event.location}</p>}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[11px] font-bold uppercase text-slate-400">RSVPs</p>
                      <p className="font-extrabold text-slate-800">{event.currentAttendees || 0}{event.maxAttendees ? ` / ${event.maxAttendees}` : ''}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[11px] font-bold uppercase text-slate-400">Status</p>
                      <p className="font-extrabold text-slate-800 capitalize">{event.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {event.status !== 'cancelled' && event.status !== 'completed' && (
                      <button onClick={() => handleCancel(event._id, event.title)}
                        className="flex-1 rounded-lg border border-rose-200 text-rose-600 px-3 py-2 text-sm font-bold hover:bg-rose-50 flex items-center justify-center gap-1">
                        <X size={14} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Create Event</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Date & Time *</label>
                <input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Location</label>
                <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Max Attendees (optional)</label>
                <input type="number" value={form.maxAttendees} onChange={e => setForm(f => ({ ...f, maxAttendees: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {['Adoption Drive','Fundraiser','Training','Community','Volunteer','Other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50">
                  {submitting ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
