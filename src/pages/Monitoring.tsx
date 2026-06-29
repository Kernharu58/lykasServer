import { Heart, AlertTriangle, CheckCircle2, Clock, Download, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, PageHeader, StatCard, Badge } from '../components/ui/SharedUI';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/StateDisplays';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

export default function Monitoring() {
  const [reports, setReports]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [searchTerm, setSearchTerm]       = useState('');
  const [filterHealth, setFilterHealth]   = useState('all');
  const [selected, setSelected]           = useState<any | null>(null);
  const { addToast } = useToast();

  const fetchReports = async (status = '') => {
    try {
      setLoading(true); setError(null);
      const params = status && status !== 'all' ? `?status=${status}&limit=100` : '?limit=100';
      const res = await api.get(`/monitoring-reports${params}`);
      setReports(res.data.reports || res.data || []);
    } catch (e: any) {
      setError('Could not load monitoring reports.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleReview = async (id: string, status: 'reviewed' | 'flagged', notes = '') => {
    try {
      await api.put(`/monitoring-reports/${id}/review`, { status, adminNotes: notes });
      addToast('success', `Report marked as ${status}.`);
      setSelected(null);
      fetchReports();
    } catch (e: any) {
      addToast('error', e.response?.data?.message || 'Could not update.');
    }
  };

  const filtered = reports.filter(r => {
    const term = searchTerm.toLowerCase();
    const matchSearch = (r.pet?.name || r.petName || '').toLowerCase().includes(term)
      || (r.submittedBy?.displayName || '').toLowerCase().includes(term);
    const matchFilter = filterHealth === 'all' || r.status === filterHealth
      || r.overallCondition?.toLowerCase() === filterHealth;
    return matchSearch && matchFilter;
  });

  const stats = {
    good:    reports.filter(r => r.overallCondition === 'Excellent' || r.overallCondition === 'Good').length,
    concern: reports.filter(r => r.overallCondition === 'Fair').length,
    alert:   reports.filter(r => r.overallCondition === 'Poor').length,
    flagged: reports.filter(r => r.status === 'flagged').length,
  };

  const healthColor = (c: string) => c === 'Excellent' || c === 'Good' ? 'success' as const : c === 'Fair' ? 'warning' as const : 'danger' as const;
  const statusColor = (s: string) => s === 'reviewed' ? 'success' as const : s === 'flagged' ? 'danger' as const : 'warning' as const;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Post-Adoption Monitoring"
        description="Track health, behavior, and welfare of adopted pets. Review reports submitted by adopters."
        action={
          <button onClick={() => { const csv = reports.map(r => `${r.pet?.name},${r.submittedBy?.displayName},${r.overallCondition},${r.status},${new Date(r.reportDate || r.createdAt).toLocaleDateString()}`).join('\n'); const b = new Blob([`Pet,Adopter,Condition,Status,Date\n${csv}`], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'monitoring.csv'; a.click(); }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">
            <Download size={18} /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Heart         size={24} />} label="Healthy Pets"     value={stats.good.toString()}    tone="emerald" />
        <StatCard icon={<Clock         size={24} />} label="Need Attention"   value={stats.concern.toString()} tone="amber" />
        <StatCard icon={<AlertTriangle size={24} />} label="Poor Condition"   value={stats.alert.toString()}   tone="amber" />
        <StatCard icon={<CheckCircle2  size={24} />} label="Flagged"          value={stats.flagged.toString()} tone="slate" />
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search pet or adopter..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'reviewed', 'flagged'].map(s => (
            <button key={s} onClick={() => { setFilterHealth(s); fetchReports(s === 'all' ? '' : s); }}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${filterHealth === s ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingState message="Loading monitoring reports..." />
        : error ? <ErrorState message={error} onRetry={() => fetchReports()} />
        : filtered.length === 0 ? <EmptyState title="No reports found" message="Monitoring reports from adopters will appear here." />
        : (
        <div className="space-y-4">
          {filtered.map(r => (
            <div key={r._id} onClick={() => setSelected(r)} className="cursor-pointer">
            <Card noPadding className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg text-slate-800">{r.pet?.name || r.petName || 'Unknown Pet'}</h3>
                    <Badge variant={healthColor(r.overallCondition)}>{r.overallCondition}</Badge>
                    <Badge variant={statusColor(r.status)}>{r.status}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Adopter: {r.submittedBy?.displayName || '—'}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600">
                    <span>📅 Month {r.reportMonth}</span>
                    {r.currentWeight && <span>⚖ {r.currentWeight}</span>}
                    {r.behaviorAtHome && <span>🐾 {r.behaviorAtHome.slice(0, 30)}{r.behaviorAtHome.length > 30 ? '...' : ''}</span>}
                  </div>
                </div>
                <div className="text-xs text-slate-500 md:text-right">
                  <p>Submitted: {new Date(r.reportDate || r.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  {r.status === 'pending' && (
                    <button onClick={() => handleReview(r._id, 'reviewed')}
                      className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-sm">
                      Approve
                    </button>
                  )}
                  {r.status !== 'flagged' && (
                    <button onClick={() => handleReview(r._id, 'flagged')}
                      className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-sm">
                      Flag
                    </button>
                  )}
                </div>
              </div>
            </Card>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{selected.pet?.name || selected.petName}</h2>
                <p className="text-slate-500 text-sm">Month {selected.reportMonth} · {new Date(selected.reportDate || selected.createdAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                ['Adopter',        selected.submittedBy?.displayName],
                ['Overall Condition', selected.overallCondition],
                ['Weight',         selected.currentWeight],
                ['Diet',           selected.diet],
                ['Behavior',       selected.behaviorAtHome],
                ['Concerns',       selected.issuesOrConcerns],
                ['Comments',       selected.comments],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">{label as string}</p>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{value as string}</p>
                </div>
              ))}
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-50">Close</button>
                {selected.status !== 'reviewed' && (
                  <button onClick={() => handleReview(selected._id, 'reviewed')} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700">Mark Reviewed</button>
                )}
                {selected.status !== 'flagged' && (
                  <button onClick={() => handleReview(selected._id, 'flagged')} className="px-4 py-2 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700">Flag</button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
