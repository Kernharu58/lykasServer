import { Activity, CalendarClock, HeartHandshake, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Card, PageHeader, SectionHeader, StatCard } from '../components/ui/SharedUI';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/StateDisplays';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

interface Foster {
  _id: string;
  pet: { _id: string; name: string; species: string };
  fosterer: { _id: string; displayName: string; email: string };
  startDate: string;
  expectedEndDate?: string;
  status: 'active' | 'completed' | 'cancelled';
  fosterAgreementSigned: boolean;
  trialDurationDays?: number;
  weeklyReportsRequired?: number;
  weeklyReportsSubmitted?: number;
  outcome?: 'ADOPTED' | 'RETURNED' | 'EXTENDED' | null;
}

function daysLeft(date?: string) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function reportProgress(foster: Foster) {
  if (!foster.weeklyReportsRequired) return null;
  return `${foster.weeklyReportsSubmitted ?? 0}/${foster.weeklyReportsRequired}`;
}

export default function Fosters() {
  const [fosters, setFosters]           = useState<Foster[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [selected, setSelected]         = useState<Foster | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [returnNotes, setReturnNotes]   = useState('');
  const [outcome, setOutcome]           = useState<'ADOPTED' | 'RETURNED' | 'EXTENDED'>('RETURNED');
  const [eligibility, setEligibility]   = useState<{ allowed: boolean; reason?: string } | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const { addToast } = useToast();

  const fetchFosters = async () => {
    try {
      setLoading(true); setError(null);
      const res = await api.get('/foster?status=active&limit=50');
      setFosters(res.data.fosters || res.data);
    } catch {
      setError('Could not load foster placements.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchFosters(); }, []);

  const checkEligibility = async (foster: Foster) => {
    try {
      const res = await api.get(`/foster/${foster._id}/can-finalize`);
      setEligibility(res.data);
    } catch { setEligibility(null); }
  };

  const handleSelectFoster = async (foster: Foster) => {
    setSelected(foster);
    setOutcome('RETURNED');
    setReturnNotes('');
    setEligibility(null);
    await checkEligibility(foster);
    setShowEndModal(true);
  };

  const handleEnd = async () => {
    if (!selected) return;
    if (outcome === 'ADOPTED' && eligibility && !eligibility.allowed) {
      addToast('error', eligibility.reason || 'Not eligible for adoption yet.');
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/foster/${selected._id}/end`, { returnNotes, outcome });
      addToast('success', `Foster for ${selected.pet.name}: ${outcome}`);
      setShowEndModal(false); setSelected(null); setReturnNotes('');
      fetchFosters();
    } catch (e: any) {
      addToast('error', e.response?.data?.message || 'Could not end placement.');
    } finally { setSubmitting(false); }
  };

  const active     = fosters.filter(f => f.status === 'active');
  const endingSoon = fosters.filter(f => { const d = daysLeft(f.expectedEndDate); return d !== null && d <= 14 && d >= 0; });
  const reportsOk  = fosters.filter(f => f.weeklyReportsRequired && f.weeklyReportsSubmitted === f.weeklyReportsRequired);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Foster Management"
        description="Track mandatory trial periods, health updates, and foster-to-adoption decisions."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<HeartHandshake size={22} />} label="Active Fosters"   value={active.length.toString()}       tone="emerald" />
        <StatCard icon={<CalendarClock  size={22} />} label="Ending Soon"      value={endingSoon.length.toString()}   tone="amber"   />
        <StatCard icon={<Activity       size={22} />} label="Reports Complete" value={reportsOk.length.toString()}    tone="blue"    />
        <StatCard icon={<ShieldCheck    size={22} />} label="Total Placements" value={fosters.length.toString()}      tone="purple"  />
      </div>

      {loading && <LoadingState message="Loading foster placements..." />}
      {error   && <ErrorState message={error} onRetry={fetchFosters} />}

      {!loading && !error && (
        <Card noPadding>
          <div className="p-5 border-b border-slate-100 bg-slate-50/60">
            <SectionHeader title="Active Foster Placements" description="Showing active placements only. Use the Finalize button to close a trial." />
          </div>

          {fosters.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No active placements"
                message="Foster placements created from approved adoption applications will appear here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pet</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fosterer</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Trial</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Reports</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Days Left</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Agreement</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {fosters.map(f => {
                    const dl = daysLeft(f.expectedEndDate);
                    const rp = reportProgress(f);
                    const reportsComplete = f.weeklyReportsRequired
                      ? f.weeklyReportsSubmitted === f.weeklyReportsRequired
                      : true;
                    return (
                      <tr key={f._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-semibold text-slate-800">{f.pet?.name}</td>
                        <td className="px-5 py-4">
                          <p className="text-slate-800 font-medium">{f.fosterer?.displayName}</p>
                          <p className="text-xs text-slate-400">{f.fosterer?.email}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-500">{f.trialDurationDays ? `${f.trialDurationDays}d` : '—'}</td>
                        <td className="px-5 py-4">
                          <span className={`font-semibold ${reportsComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {rp || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {dl !== null
                            ? <span className={`font-semibold ${dl <= 7 ? 'text-rose-600' : dl <= 14 ? 'text-amber-600' : 'text-slate-600'}`}>{dl}d</span>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          {f.fosterAgreementSigned
                            ? <Badge variant="success">Signed</Badge>
                            : <Badge variant="warning">Pending</Badge>}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleSelectFoster(f)}
                            className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Finalize
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Finalize Modal */}
      {showEndModal && selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-extrabold text-slate-800 mb-0.5">Finalize: {selected.pet.name}</h3>
            <p className="text-sm text-slate-500 mb-5">Fosterer: <span className="font-medium text-slate-700">{selected.fosterer.displayName}</span></p>

            {/* Eligibility banner */}
            {eligibility && (
              <div className={`flex items-start gap-2.5 rounded-xl p-3 mb-4 border ${eligibility.allowed ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-100'}`}>
                {eligibility.allowed
                  ? <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                  : <XCircle      size={18} className="text-rose-500  mt-0.5 shrink-0" />
                }
                <div>
                  <p className={`text-sm font-semibold ${eligibility.allowed ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {eligibility.allowed ? 'Eligible for adoption' : 'Not yet eligible'}
                  </p>
                  {!eligibility.allowed && eligibility.reason && (
                    <p className="text-xs text-rose-600 mt-0.5">{eligibility.reason}</p>
                  )}
                </div>
              </div>
            )}

            {/* Report progress */}
            {selected.weeklyReportsRequired != null && (
              <div className="mb-4 bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-sm text-slate-600">
                  Weekly reports:{' '}
                  <span className="font-semibold text-slate-800">
                    {selected.weeklyReportsSubmitted ?? 0} / {selected.weeklyReportsRequired} submitted
                  </span>
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Outcome</label>
              <select
                value={outcome}
                onChange={e => setOutcome(e.target.value as any)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              >
                <option value="RETURNED">Return to shelter</option>
                <option value="EXTENDED">Extend trial (14 days)</option>
                <option value="ADOPTED">Finalize adoption</option>
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Staff notes</label>
              <textarea
                value={returnNotes}
                onChange={e => setReturnNotes(e.target.value)}
                placeholder="Optional notes about this decision…"
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowEndModal(false); setSelected(null); }}
                className="flex-1 border border-slate-200 text-slate-700 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEnd}
                disabled={submitting || (outcome === 'ADOPTED' && eligibility !== null && !eligibility?.allowed)}
                className="flex-1 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
