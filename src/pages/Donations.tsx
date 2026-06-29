import { useState, useEffect } from 'react';
import { DollarSign, HeartHandshake, TrendingUp, Download, Search, Eye } from 'lucide-react';
import api from '../services/api';
import { ErrorState, LoadingState, EmptyState } from '../components/ui/StateDisplays';
import { Badge, Card, PageHeader, SectionHeader, StatCard, Toolbar } from '../components/ui/SharedUI';
import { useToast } from '../context/ToastContext';

interface Donation {
  _id: string;
  donorName: string;
  email?: string;
  amount: number;
  date: string;
  method: string;
  status: string;
  campaign: string;
  paymongoRefId?: string;
}

const MOCK_DONATIONS: Donation[] = [
  { _id: '1', donorName: 'Maria Santos',   email: 'maria@gmail.com',   amount: 5000, date: '2026-06-05', method: 'GCash',         status: 'Completed', campaign: 'General Fund',   paymongoRefId: 'pay_123' },
  { _id: '2', donorName: 'Juan Dela Cruz', email: 'juan@yahoo.com',    amount: 2500, date: '2026-06-04', method: 'Credit Card',   status: 'Completed', campaign: 'Medical Care',   paymongoRefId: 'pay_124' },
  { _id: '3', donorName: 'Anonymous',      email: 'anon@email.com',    amount: 1000, date: '2026-06-03', method: 'Bank Transfer', status: 'Pending',   campaign: 'Food & Supplies',paymongoRefId: 'pay_125' },
  { _id: '4', donorName: 'Rosa Garcia',    email: 'rosa@outlook.com',  amount: 3500, date: '2026-06-02', method: 'PayMaya',       status: 'Completed', campaign: 'General Fund',   paymongoRefId: 'pay_126' },
  { _id: '5', donorName: 'Carlos Reyes',   email: 'carlos@gmail.com',  amount: 7500, date: '2026-06-01', method: 'Credit Card',   status: 'Completed', campaign: 'Building Fund',  paymongoRefId: 'pay_127' },
];

function statusVariant(s: string): 'success' | 'warning' | 'danger' {
  if (s === 'Completed') return 'success';
  if (s === 'Pending')   return 'warning';
  return 'danger';
}

export default function Donations() {
  const [donations, setDonations]     = useState<Donation[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [searchTerm, setSearchTerm]   = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [useMockData, setUseMockData] = useState(false);
  const { addToast } = useToast();

  const fetchDonations = async () => {
    try {
      setIsLoading(true); setError(null);
      const response = await api.get('/payments?type=donation&status=paid&limit=50');
      const payments = response.data.payments || response.data || [];
      const mapped: Donation[] = payments.map((p: any) => ({
        _id:           p._id,
        donorName:     p.paidBy?.displayName || 'Anonymous',
        email:         p.paidBy?.email || '',
        amount:        (p.amount || 0) / 100,
        date:          p.paidAt || p.createdAt,
        method:        p.paymentMethod || 'PayMongo',
        status:        p.status === 'paid' ? 'Completed' : p.status === 'failed' ? 'Failed' : 'Pending',
        campaign:      p.description || 'General Fund',
        paymongoRefId: p.paymongoPaymentId || '',
      }));
      setDonations(mapped);
      setUseMockData(false);
    } catch {
      setError("Could not load donation records — showing sample data instead.");
      setDonations(MOCK_DONATIONS);
      setUseMockData(true);
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchDonations(); }, []);

  const handleExportCSV = () => {
    const header = 'Donor,Email,Amount,Campaign,Method,Date,Status\n';
    const rows = donations.map(d =>
      `"${d.donorName}","${d.email || ''}",${d.amount},"${d.campaign}","${d.method}","${new Date(d.date).toLocaleDateString()}","${d.status}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'donations.csv'; a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Export downloaded.');
  };

  const filtered = donations.filter(d => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = d.donorName.toLowerCase().includes(q) || (d.email?.toLowerCase().includes(q)) || d.campaign.toLowerCase().includes(q);
    const matchesFilter = filterStatus === 'all' || d.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalRaised     = donations.reduce((s, d) => s + d.amount, 0);
  const totalThisMonth  = donations.filter(d => new Date(d.date).getMonth() === new Date().getMonth()).reduce((s, d) => s + d.amount, 0);
  const uniqueDonors    = new Set(donations.map(d => d.email)).size;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Donations"
        description="Track financial contributions and donor history."
        action={
          <button
            onClick={handleExportCSV}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Download size={18} />
            Export CSV
          </button>
        }
      />

      {useMockData && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
          Showing sample data — backend not yet connected.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={<DollarSign    size={22} />} label="Total Raised (Year)"  value={`₱${totalRaised.toLocaleString()}`}    tone="emerald" />
        <StatCard icon={<TrendingUp    size={22} />} label="Donations This Month" value={`₱${totalThisMonth.toLocaleString()}`}  tone="blue"    />
        <StatCard icon={<HeartHandshake size={22}/>} label="Unique Donors"        value={String(uniqueDonors)}                   tone="purple"  />
      </div>

      {error && !useMockData ? (
        <ErrorState title="Could not load donations" message={error} onRetry={fetchDonations} />
      ) : isLoading ? (
        <LoadingState message="Loading financial records..." />
      ) : (
        <Card noPadding>
          <Toolbar>
            <SectionHeader title="Recent Transactions" description={`${filtered.length} of ${donations.length} records`} />
            <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3">
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search donors…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'completed', 'pending', 'failed'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${filterStatus === s ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No donations found" message="Try adjusting your search or filter." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[780px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Donor</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Campaign</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Method</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(d => (
                    <tr key={d._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">{d.donorName}</p>
                        {d.email && <p className="text-xs text-slate-400 mt-0.5">{d.email}</p>}
                      </td>
                      <td className="px-5 py-4 font-bold text-emerald-600">₱{d.amount.toLocaleString()}</td>
                      <td className="px-5 py-4 text-slate-600">{d.campaign}</td>
                      <td className="px-5 py-4 text-slate-600">{d.method}</td>
                      <td className="px-5 py-4 text-slate-500">{new Date(d.date).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors" title="View details">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
            <span>Showing {filtered.length} of {donations.length} donations</span>
          </div>
        </Card>
      )}
    </div>
  );
}
