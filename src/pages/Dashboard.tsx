import { useState, useEffect } from 'react';
import { PawPrint, HeartHandshake, Users, Activity, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { PageHeader, Card, SectionHeader, StatCard } from '../components/ui/SharedUI';

interface RecentActivity {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  timestamp: string;
  type: 'adoption' | 'volunteer' | 'chat' | 'foster';
}

export default function Dashboard() {
  const [stats, setStats] = useState({ 
    availablePets: 0, 
    pendingAdoptions: 0, 
    activeVolunteers: 0,
    totalDonations: 0,
    upcomingEvents: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await api.get('/dashboard');
        const d = res.data;

        setStats({
          availablePets:    d.pets?.available        || 0,
          pendingAdoptions: d.applications?.pending  || 0,
          activeVolunteers: d.volunteers?.active     || 0,
          totalDonations:   d.financials?.totalDonations + d.financials?.totalAdoptionFees || 0,
          upcomingEvents:   d.pipeline?.activeFosters || 0,
        });

        // Map real recent applications to activity items
        const appActivity: RecentActivity[] = (d.recent?.applications || []).slice(0, 2).map((a: any) => ({
          id: a._id,
          icon: <CheckCircle2 size={20} className="text-emerald-600" />,
          title: `Application ${a.status}`,
          description: `${a.applicant?.displayName || 'Applicant'} applied for ${a.pet?.name || 'a pet'}`,
          timestamp: new Date(a.createdAt).toLocaleDateString(),
          type: 'adoption' as const,
        }));

        const payActivity: RecentActivity[] = (d.recent?.payments || []).slice(0, 2).map((p: any) => ({
          id: p._id,
          icon: <TrendingUp size={20} className="text-purple-600" />,
          title: `Payment received`,
          description: `${p.paidBy?.displayName || 'Donor'} — ₱${((p.amount || 0) / 100).toLocaleString()}`,
          timestamp: p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '',
          type: 'adoption' as const,
        }));

        const emergencyActivity: RecentActivity[] = (d.recent?.emergencyReports || []).slice(0, 1).map((r: any) => ({
          id: r._id,
          icon: <AlertCircle size={20} className="text-amber-600" />,
          title: 'Emergency Report',
          description: `${r.type?.replace(/_/g, ' ')} — ${r.location}`,
          timestamp: new Date(r.createdAt).toLocaleDateString(),
          type: 'foster' as const,
        }));

        setRecentActivity([...appActivity, ...payActivity, ...emergencyActivity]);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 h-[70vh] flex flex-col justify-center items-center">
        <Activity className="animate-spin text-emerald-600 mb-4" size={40} />
        <p className="text-slate-500 font-medium">Calculating metrics...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader 
        title="Dashboard Overview" 
        description="Real-time metrics and system status for the shelter." 
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card className="flex items-center relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 transform group-hover:scale-110 transition-transform duration-500">
            <PawPrint size={80} />
          </div>
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mr-4 shrink-0">
            <PawPrint size={22} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-0.5">Available Pets</h3>
            <p className="text-2xl font-extrabold text-slate-800">{stats.availablePets}</p>
          </div>
        </Card>

        <Card className="flex items-center relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 transform group-hover:scale-110 transition-transform duration-500">
            <HeartHandshake size={80} />
          </div>
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mr-4 shrink-0">
            <HeartHandshake size={22} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-0.5">Pending Adoptions</h3>
            <p className="text-2xl font-extrabold text-slate-800">{stats.pendingAdoptions}</p>
          </div>
        </Card>

        <Card className="flex items-center relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 transform group-hover:scale-110 transition-transform duration-500">
            <Users size={80} />
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4 shrink-0">
            <Users size={22} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-0.5">Active Volunteers</h3>
            <p className="text-2xl font-extrabold text-slate-800">{stats.activeVolunteers}</p>
          </div>
        </Card>

        <Card className="flex items-center relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 transform group-hover:scale-110 transition-transform duration-500">
            <TrendingUp size={80} />
          </div>
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4 shrink-0">
            <TrendingUp size={22} className="text-purple-600" />
          </div>
          <div>
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-0.5">Total Donations</h3>
            <p className="text-2xl font-extrabold text-slate-800">₱{stats.totalDonations > 0 ? (stats.totalDonations / 1000).toFixed(0) + 'K' : '—'}</p>
          </div>
        </Card>

        <Card className="flex items-center relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 transform group-hover:scale-110 transition-transform duration-500">
            <Activity size={80} />
          </div>
          <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center mr-4 shrink-0">
            <Activity size={22} className="text-rose-600" />
          </div>
          <div>
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-0.5">Upcoming Events</h3>
            <p className="text-2xl font-extrabold text-slate-800">{stats.upcomingEvents}</p>
          </div>
        </Card>
      </div>

      {/* Status Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl shadow-slate-900/10 mb-8">
        <div className="absolute right-0 bottom-0 opacity-[0.03] transform translate-x-1/4 translate-y-1/4">
          <PawPrint size={200} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">System Online</h2>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold mb-2">Mobile App Connected</h3>
            <p className="text-slate-300 leading-relaxed text-sm sm:text-base">
              The CarePaws app is actively routing applications and messages to this dashboard. Keep an eye on Live Chat for incoming community questions!
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-400">100%</p>
            <p className="text-slate-400 text-xs">Operational</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <Card noPadding>
        <div className="p-5 border-b border-slate-100 bg-slate-50/70">
          <SectionHeader title="Recent Activity" description="Latest shelter updates and events" />
        </div>
        <div className="divide-y divide-slate-100">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="p-5 hover:bg-slate-50 transition-colors flex items-start gap-4">
              <div className="mt-1">
                {activity.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-800">{activity.title}</h4>
                <p className="text-sm text-slate-600 mt-1">{activity.description}</p>
                <p className="text-xs text-slate-400 mt-2">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}