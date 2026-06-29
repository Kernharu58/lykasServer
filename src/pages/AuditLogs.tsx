import { useEffect, useState } from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateDisplays';
import { Badge, Card, PageHeader, SectionHeader } from '../components/ui/SharedUI';

interface AuditLog {
  _id: string;
  action: string;
  createdAt: string;
  actor?: {
    displayName?: string;
    email?: string;
  } | null;
  targetUser?: {
    displayName?: string;
    email?: string;
  } | null;
  metadata?: Record<string, any>;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [filterAction, setFilterAction] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 25;

  const fetchLogs = async (p = page, action = filterAction) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (action) params.set('action', action);
      const response = await api.get(`/audit-logs?${params}`);
      setLogs(response.data.logs || response.data);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (fetchError: any) {
      console.error('Error fetching audit logs:', fetchError);
      setError('Unable to load audit logs right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchActions = async () => {
    try {
      const res = await api.get('/audit-logs/actions');
      setActions(res.data || []);
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    fetchLogs();
    fetchActions();
  }, []);

  const handleFilterChange = (action: string) => {
    setFilterAction(action);
    setPage(1);
    fetchLogs(1, action);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchLogs(newPage, filterAction);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="System Audit Logs"
        description="Track privileged actions, access changes, and administrative activity across the platform."
      />

      <Card noPadding>
        <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SectionHeader
            title="Security Activity Timeline"
            description="Review who acted, what changed, and when it happened."
          />
          {actions.length > 0 && (
            <select
              value={filterAction}
              onChange={e => handleFilterChange(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All actions</option>
              {actions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          )}
        </div>

        <div className="p-5 sm:p-6">
          {error ? (
            <ErrorState
              title="Audit Logs Unavailable"
              message={error}
              onRetry={() => fetchLogs()}
            />
          ) : loading ? (
            <LoadingState message="Loading audit trail..." />
          ) : logs.length === 0 ? (
            <EmptyState
              title="No audit activity found"
              message="Once privileged actions are recorded, they will appear here."
              icon={<ShieldAlert size={48} />}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  <thead>
                    <tr className="bg-slate-50/40 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold">Timestamp</th>
                      <th className="p-4 font-bold">Action</th>
                      <th className="p-4 font-bold">Actor</th>
                      <th className="p-4 font-bold">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id} className="border-b border-slate-50 hover:bg-slate-50/70">
                        <td className="p-4 text-sm text-slate-500 font-medium">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <Badge variant="default">{log.action.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="p-4 font-semibold text-slate-800">
                          {log.actor?.displayName || 'System'}
                          {log.actor?.email && <span className="block text-xs text-slate-400 font-normal">{log.actor.email}</span>}
                        </td>
                        <td className="p-4">
                          {log.targetUser ? (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <ArrowRight size={14} className="text-slate-400" />
                              <span>
                                {log.targetUser.displayName}
                                {log.targetUser.email && <span className="block text-xs text-slate-400">{log.targetUser.email}</span>}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm italic">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm border-t border-slate-100 pt-4">
                  <span className="text-slate-500">Page {page} of {totalPages}</span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => handlePageChange(page - 1)}
                      className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-40"
                    >Previous</button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => handlePageChange(page + 1)}
                      className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-40"
                    >Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
