import { BarChart3, Download, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, PageHeader, SectionHeader, StatCard } from '../components/ui/SharedUI';
import { LoadingState, ErrorState } from '../components/ui/StateDisplays';
import api from '../services/api';

export default function Reports() {
  const [adoptions,  setAdoptions]  = useState<any>(null);
  const [financial,  setFinancial]  = useState<any>(null);
  const [volunteers, setVolunteers] = useState<any>(null);
  const [welfare,    setWelfare]    = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');

  const fetchAll = async () => {
    try {
      setLoading(true); setError(null);
      const params = `?from=${from}&to=${to}`;
      const [a, f, v, w] = await Promise.all([
        api.get(`/reports/adoptions${params}`),
        api.get(`/reports/financial${params}`),
        api.get(`/reports/volunteers${params}`),
        api.get(`/reports/welfare${params}`),
      ]);
      setAdoptions(a.data);
      setFinancial(f.data);
      setVolunteers(v.data);
      setWelfare(w.data);
    } catch (e: any) {
      setError('Could not load reports.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const exportCSV = (data: any[], filename: string) => {
    if (!data?.length) return;
    const keys = Object.keys(data[0]);
    const csv  = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const b    = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(b);
    a.download = filename;
    a.click();
  };

  const maxBar = adoptions?.byMonth?.length
    ? Math.max(...adoptions.byMonth.map((m: any) => m.total || 0), 1)
    : 1;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Reports & Analytics"
        description="Operational trends for adoptions, adopter vetting, volunteer coverage, and donations."
        action={
          <div className="flex flex-wrap gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={fetchAll}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
              Apply
            </button>
          </div>
        }
      />

      {loading ? <LoadingState message="Loading reports..." />
        : error ? <ErrorState message={error} onRetry={fetchAll} />
        : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard icon={<TrendingUp   size={24} />} label="Approval Rate"    value={`${adoptions?.summary?.approvalRate || 0}%`}           tone="emerald" />
            <StatCard icon={<TrendingDown size={24} />} label="Avg. Process Days" value={`${adoptions?.summary?.avgProcessingDays || 0}d`}      tone="amber" />
            <StatCard icon={<BarChart3    size={24} />} label="Total Revenue"     value={`₱${(financial?.summary?.totalRevenue || 0).toLocaleString()}`} tone="blue" />
            <StatCard icon={<Users        size={24} />} label="Active Volunteers" value={volunteers?.summary?.approved?.toString() || '0'}      tone="slate" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Adoption trend bar chart */}
            <Card>
              <SectionHeader title="Adoption Trend" description="Applications per month" />
              <div className="mt-6 flex h-52 items-end gap-2 rounded-lg bg-slate-50 p-4">
                {adoptions?.byMonth?.length ? adoptions.byMonth.map((m: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-emerald-700/90" style={{ height: `${((m.total || 0) / maxBar) * 100}%`, minHeight: 4 }} title={`Month ${m._id?.month}: ${m.total}`} />
                    <span className="text-[9px] text-slate-400">{m._id?.month}</span>
                  </div>
                )) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No data</div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-slate-500 uppercase">Total</p>
                  <p className="font-extrabold text-slate-800">{adoptions?.summary?.total || 0}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-emerald-600 uppercase">Approved</p>
                  <p className="font-extrabold text-emerald-800">{adoptions?.summary?.approved || 0}</p>
                </div>
                <div className="bg-rose-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-rose-500 uppercase">Rejected</p>
                  <p className="font-extrabold text-rose-800">{adoptions?.summary?.rejected || 0}</p>
                </div>
              </div>
            </Card>

            {/* Financial summary */}
            <Card>
              <SectionHeader title="Financial Summary" description="Adoption fees + donations" />
              <div className="mt-5 space-y-4">
                {[
                  { label: 'Total Donations',    value: financial?.summary?.totalDonations,    color: 'bg-emerald-600' },
                  { label: 'Adoption Fees',       value: financial?.summary?.totalAdoptionFees, color: 'bg-teal-500' },
                  { label: 'Total Revenue',        value: financial?.summary?.totalRevenue,      color: 'bg-slate-700' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1 text-sm font-bold text-slate-700">
                      <span>{label}</span>
                      <span>₱{(value || 0).toLocaleString()}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div className={`h-3 rounded-full ${color}`}
                        style={{ width: `${Math.min(100, ((value || 0) / Math.max(financial?.summary?.totalRevenue || 1, 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-bold text-slate-500 uppercase">Donations</p>
                    <p className="font-extrabold text-slate-800">{financial?.summary?.donationCount || 0}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-bold text-slate-500 uppercase">Fee Payments</p>
                    <p className="font-extrabold text-slate-800">{financial?.summary?.feeCount || 0}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Top volunteers */}
            <Card>
              <SectionHeader title="Top Volunteers" description="By total hours logged" />
              <div className="mt-5 space-y-3">
                {volunteers?.topVolunteers?.length
                  ? volunteers.topVolunteers.slice(0, 5).map((v: any) => (
                    <div key={v._id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <span className="text-sm font-bold text-slate-700">{v.user?.displayName || 'Volunteer'}</span>
                      <span className="text-sm font-extrabold text-emerald-700">{v.totalHours || 0} hrs</span>
                    </div>
                  ))
                  : <p className="text-sm text-slate-400">No volunteer data yet.</p>}
              </div>
            </Card>

            {/* Welfare summary */}
            <Card>
              <SectionHeader title="Welfare & Foster" description="Post-adoption outcomes" />
              <div className="mt-5 space-y-3">
                {welfare && Object.entries({
                  'Active Fosters':           welfare.foster?.active,
                  'Completed Fosters':        welfare.foster?.completed,
                  'Monitoring Reports':       welfare.monitoring?.submitted,
                  'Flagged Reports':          welfare.monitoring?.flagged,
                  'Interviews Passed':        welfare.interviews?.passed,
                  'Home Visits Passed':       welfare.homeVisits?.passed,
                }).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <span className="text-sm font-bold text-slate-700">{label}</span>
                    <span className="text-sm font-extrabold text-slate-800">{value ?? 0}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Export buttons */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Adoptions CSV',    () => exportCSV(adoptions?.byMonth || [], 'adoptions.csv')],
              ['Financial CSV',    () => exportCSV(financial?.byMonth  || [], 'financial.csv')],
              ['Volunteers CSV',   () => exportCSV(volunteers?.topVolunteers || [], 'volunteers.csv')],
              ['Welfare CSV',      () => exportCSV([welfare?.foster, welfare?.monitoring, welfare?.interviews].filter(Boolean), 'welfare.csv')],
            ].map(([label, fn]) => (
              <button key={label as string} onClick={fn as () => void}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <Download size={16} /> {label as string}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
