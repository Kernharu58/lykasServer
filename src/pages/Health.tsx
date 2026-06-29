import { Bell, CalendarCheck, HeartPulse, Syringe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Card, PageHeader, SectionHeader, StatCard } from '../components/ui/SharedUI';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/StateDisplays';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

export default function Health() {
  const [reports, setReports]         = useState<any[]>([]);
  const [upcoming, setUpcoming]       = useState<any[]>([]);
  const [flagged, setFlagged]         = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true); setError(null);
      const [reportsRes, upcomingRes, flaggedRes] = await Promise.allSettled([
        api.get('/monitoring-reports?limit=50'),
        api.get('/medical/vaccinations/upcoming'),
        api.get('/monitoring-reports?status=flagged&limit=20'),
      ]);
      if (reportsRes.status  === 'fulfilled') setReports(reportsRes.value.data.reports  || reportsRes.value.data  || []);
      if (upcomingRes.status === 'fulfilled') setUpcoming(upcomingRes.value.data || []);
      if (flaggedRes.status  === 'fulfilled') setFlagged(flaggedRes.value.data.reports   || flaggedRes.value.data  || []);
    } catch (e: any) {
      setError('Could not load health data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleReview = async (id: string, status: 'reviewed' | 'flagged') => {
    try {
      await api.put(`/monitoring-reports/${id}/review`, { status });
      addToast('success', `Report marked as ${status}.`);
      fetchData();
    } catch (e: any) {
      addToast('error', e.response?.data?.message || 'Could not update report.');
    }
  };

  const vaccineVariant = (d: string) => {
    const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    if (days <= 0)  return 'danger'  as const;
    if (days <= 7)  return 'warning' as const;
    return 'info' as const;
  };

  const conditionVariant = (c: string) => {
    if (c === 'Excellent' || c === 'Good') return 'success' as const;
    if (c === 'Fair')                      return 'warning' as const;
    return 'danger' as const;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Health & Baby Book"
        description="Monitor post-adoption health timelines, vaccination reminders, and adopter updates."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<HeartPulse size={24} />} label="Monitoring Reports"  value={reports.length.toString()}           tone="emerald" />
        <StatCard icon={<Syringe    size={24} />} label="Vaccines Due Soon"   value={upcoming.length.toString()}           tone="amber" />
        <StatCard icon={<Bell       size={24} />} label="Flagged Reports"     value={flagged.length.toString()}            tone="blue" />
        <StatCard icon={<CalendarCheck size={24} />} label="Pending Review"   value={reports.filter((r: any) => r.status === 'pending').length.toString()} tone="slate" />
      </div>

      {loading ? <LoadingState message="Loading health data..." />
        : error ? <ErrorState message={error} onRetry={fetchData} />
        : (
        <div className="space-y-6">
          {/* Upcoming vaccinations */}
          {upcoming.length > 0 && (
            <Card noPadding>
              <div className="p-5 border-b border-slate-100 bg-amber-50/60">
                <SectionHeader title="⚡ Vaccination Reminders" description="Pets with upcoming or overdue vaccinations." />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead className="text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="p-4">Pet</th>
                      <th className="p-4">Vaccine</th>
                      <th className="p-4">Given</th>
                      <th className="p-4">Next Due</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((v: any) => (
                      <tr key={v._id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-800">{v.pet?.name || '—'}</td>
                        <td className="p-4 text-slate-700">{v.vaccineName}</td>
                        <td className="p-4 text-sm text-slate-600">{new Date(v.dateGiven).toLocaleDateString()}</td>
                        <td className="p-4 text-sm text-slate-600">{new Date(v.nextDueDate).toLocaleDateString()}</td>
                        <td className="p-4">
                          <Badge variant={vaccineVariant(v.nextDueDate)}>
                            {Math.ceil((new Date(v.nextDueDate).getTime() - Date.now()) / 86400000) <= 0 ? 'Overdue' : 'Due Soon'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Monitoring reports */}
          <Card noPadding>
            <div className="p-5 border-b border-slate-100 bg-slate-50/70">
              <SectionHeader title="Post-Adoption Monitoring Reports" description="Reports submitted by adopters via the mobile app." />
            </div>
            {reports.length === 0
              ? <div className="p-6"><EmptyState title="No reports yet" message="Monitoring reports from adopters will appear here." /></div>
              : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead className="text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="p-4">Pet</th>
                      <th className="p-4">Adopter</th>
                      <th className="p-4">Month</th>
                      <th className="p-4">Condition</th>
                      <th className="p-4">Submitted</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r: any) => (
                      <tr key={r._id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-800">{r.pet?.name || r.petName || '—'}</td>
                        <td className="p-4 text-slate-700">{r.submittedBy?.displayName || '—'}</td>
                        <td className="p-4 text-sm text-slate-600">Month {r.reportMonth}</td>
                        <td className="p-4"><Badge variant={conditionVariant(r.overallCondition)}>{r.overallCondition}</Badge></td>
                        <td className="p-4 text-sm text-slate-600">{new Date(r.reportDate || r.createdAt).toLocaleDateString()}</td>
                        <td className="p-4">
                          <Badge variant={r.status === 'reviewed' ? 'success' : r.status === 'flagged' ? 'danger' : 'warning'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            {r.status === 'pending' && (
                              <button onClick={() => handleReview(r._id, 'reviewed')}
                                className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                                Mark Reviewed
                              </button>
                            )}
                            {r.status !== 'flagged' && (
                              <button onClick={() => handleReview(r._id, 'flagged')}
                                className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-100">
                                Flag
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
