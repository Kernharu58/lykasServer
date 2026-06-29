import { AlertTriangle, FileText, ShieldAlert, UserCheck, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Card, PageHeader, SectionHeader, StatCard } from '../components/ui/SharedUI';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/StateDisplays';
import api from '../services/api';

function riskLabel(level: string) {
  if (level === 'High')   return 'danger'  as const;
  if (level === 'Medium') return 'warning' as const;
  if (level === 'Low')    return 'success' as const;
  return 'default' as const;
}

export default function Adopters() {
  const [profiles, setProfiles]       = useState<any[]>([]);
  const [selected, setSelected]       = useState<any | null>(null);
  const [profile,  setProfile]        = useState<any | null>(null);
  const [loading,  setLoading]        = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error,    setError]          = useState<string | null>(null);
  const [search,   setSearch]         = useState('');
  const [page,     setPage]           = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const LIMIT = 20;

  const fetchProfiles = async (p = 1) => {
    try {
      setLoading(true); setError(null);
      const res = await api.get(`/adopter-profile?page=${p}&limit=${LIMIT}`);
      setProfiles(res.data.profiles || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (e: any) {
      setError('Could not load adopter profiles.');
    } finally { setLoading(false); }
  };

  const fetchDetail = async (userId: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/adopter-profile/${userId}`);
      setProfile(res.data);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleView = (row: any) => {
    setSelected(row);
    fetchDetail(row._id);
  };

  const filtered = profiles.filter(p =>
    (p.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const highRisk = profiles.filter(p => p.riskLevel === 'High').length;
  const flagged  = profiles.filter(p => p.flaggedReports > 0).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Adopter Profiles & Risk"
        description="Review adopter history, compliance score, risk indicators, and application records."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<UserCheck  size={24} />} label="Total Adopters"   value={profiles.length.toString()} tone="emerald" />
        <StatCard icon={<ShieldAlert size={24} />} label="High Risk"        value={highRisk.toString()}        tone="amber" />
        <StatCard icon={<AlertTriangle size={24} />} label="Flagged Reports" value={flagged.toString()}        tone="slate" />
        <StatCard icon={<FileText   size={24} />} label="Pages"             value={totalPages.toString()}      tone="blue" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        <Card noPadding>
          <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center gap-3">
            <SectionHeader title="Adopter Directory" description="Risk level is auto-calculated from risk assessments." />
            <div className="relative sm:w-64 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Search name or email..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          {loading ? <div className="p-6"><LoadingState message="Loading adopters..." /></div>
            : error ? <div className="p-6"><ErrorState message={error} onRetry={() => fetchProfiles()} /></div>
            : filtered.length === 0 ? <div className="p-6"><EmptyState title="No adopters found" message="Adopters who have submitted applications will appear here." /></div>
            : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Applications</th>
                      <th className="p-4">Adopted</th>
                      <th className="p-4">Risk Level</th>
                      <th className="p-4">Flags</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p._id} className={`border-t border-slate-100 hover:bg-slate-50 ${selected?._id === p._id ? 'bg-emerald-50/50' : ''}`}>
                        <td className="p-4 font-bold text-slate-800">{p.displayName}</td>
                        <td className="p-4 text-sm text-slate-600">{p.email}</td>
                        <td className="p-4 text-slate-700">{p.totalApplications || 0}</td>
                        <td className="p-4 text-slate-700">{p.totalAdoptedPets || 0}</td>
                        <td className="p-4">
                          {p.riskLevel && p.riskLevel !== 'N/A'
                            ? <Badge variant={riskLabel(p.riskLevel)}>{p.riskLevel}</Badge>
                            : <span className="text-slate-400 text-xs">Not assessed</span>}
                        </td>
                        <td className="p-4">
                          {p.flaggedReports > 0
                            ? <Badge variant="danger">{p.flaggedReports} flag{p.flaggedReports > 1 ? 's' : ''}</Badge>
                            : <span className="text-slate-400 text-xs">None</span>}
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleView(p)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="p-4 flex justify-between items-center border-t border-slate-100 text-sm">
                  <span className="text-slate-500">Page {page} of {totalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchProfiles(page - 1); }}
                      className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium">Previous</button>
                    <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); fetchProfiles(page + 1); }}
                      className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Detail panel */}
        <Card>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <UserCheck size={48} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Select an adopter to view their full profile</p>
            </div>
          ) : detailLoading ? (
            <LoadingState message="Loading profile..." />
          ) : profile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-extrabold text-lg">
                  {profile.user?.displayName?.charAt(0) || '?'}
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-900">{profile.user?.displayName}</h2>
                  <p className="text-sm text-slate-500">{profile.user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Applications',  profile.summary?.totalApplications],
                  ['Approved',      profile.summary?.approvedApplications],
                  ['Adopted Pets',  profile.summary?.totalAdoptedPets],
                  ['Fosters',       profile.summary?.totalFosters],
                  ['Compliance',    profile.summary?.complianceScore !== null ? `${profile.summary?.complianceScore}%` : 'N/A'],
                  ['Risk Level',    profile.summary?.riskLevel],
                ].map(([label, value]) => (
                  <div key={label as string} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-bold text-slate-500 uppercase">{label as string}</p>
                    <p className="font-extrabold text-slate-800 mt-1">{value ?? '—'}</p>
                  </div>
                ))}
              </div>

              {(profile.summary?.hasFailedInterview || profile.summary?.hasFailedHomeVisit || profile.summary?.hasFlaggedReports) && (
                <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 space-y-1">
                  <p className="text-xs font-bold text-rose-600 uppercase">Risk Flags</p>
                  {profile.summary?.hasFailedInterview   && <p className="text-sm text-rose-700">• Failed interview on record</p>}
                  {profile.summary?.hasFailedHomeVisit   && <p className="text-sm text-rose-700">• Failed home visit on record</p>}
                  {profile.summary?.hasFlaggedReports    && <p className="text-sm text-rose-700">• Flagged monitoring reports</p>}
                </div>
              )}

              {profile.applications?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Recent Applications</p>
                  <div className="space-y-2">
                    {profile.applications.slice(0, 3).map((a: any) => (
                      <div key={a._id} className="flex justify-between items-center text-sm bg-slate-50 rounded-lg p-2">
                        <span className="text-slate-700">{a.pet?.name || 'Unknown pet'}</span>
                        <Badge variant={a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'danger' : 'warning'}>
                          {a.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
