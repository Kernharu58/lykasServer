import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Lock,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  Key,
} from 'lucide-react';
import api from '../services/api';
import { sendUserPasswordReset } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateDisplays';
import { Badge, Card, PageHeader, SectionHeader, StatCard, Toolbar } from '../components/ui/SharedUI';
import type { User } from '../types/auth';

type UserRole = User['role'];
type UserStatus = NonNullable<User['status']>;
type ActionType = 'delete' | 'lock' | 'suspend' | 'activate' | 'role' | 'reset-password';

interface AccountUser extends User {
  _id: string;
  createdAt?: string;
}

interface ConfirmActionState {
  isOpen: boolean;
  action: ActionType | '';
  user: AccountUser | null;
  nextRole?: UserRole;
}

const emptyConfirmState: ConfirmActionState = {
  isOpen: false,
  action: '',
  user: null,
  nextRole: undefined,
};

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'user', label: 'Mobile User' },
  { value: 'staff', label: 'Shelter Staff' },
  { value: 'admin', label: 'Admin' },
];

function getStatusVariant(status: UserStatus | undefined) {
  if (status === 'locked') return 'danger';
  if (status === 'suspended') return 'warning';
  return 'success';
}

function getActionCopy(action: ConfirmActionState['action'], user: AccountUser | null, nextRole?: UserRole) {
  if (!user || !action) {
    return {
      title: 'Confirm action',
      message: 'Please confirm this account action.',
      confirmText: 'Continue',
      isDestructive: false,
    };
  }

  switch (action) {
    case 'delete':
      return {
        title: `Delete ${user.displayName || user.email}?`,
        message: 'This permanently removes the account and should only be used when recovery is no longer needed.',
        confirmText: 'Delete Account',
        isDestructive: true,
      };
    case 'lock':
      return {
        title: `Lock ${user.displayName || user.email}?`,
        message: 'Locked accounts lose access immediately. Use this for urgent security or policy issues.',
        confirmText: 'Lock Account',
        isDestructive: true,
      };
    case 'suspend':
      return {
        title: `Suspend ${user.displayName || user.email}?`,
        message: 'Suspended accounts are blocked from normal access until reactivated.',
        confirmText: 'Suspend Account',
        isDestructive: true,
      };
    case 'activate':
      return {
        title: `Reactivate ${user.displayName || user.email}?`,
        message: 'This restores normal access and removes the current restriction status.',
        confirmText: 'Reactivate Account',
        isDestructive: false,
      };
    case 'reset-password':
      return {
        title: `Send password reset to ${user.displayName || user.email}?`,
        message: 'A password reset email will be sent to this user. They can use it to set a new password.',
        confirmText: 'Send Reset Email',
        isDestructive: false,
      };
    case 'role':
      return {
        title: `Change ${user.displayName || user.email} to ${nextRole?.replace('_', ' ')}?`,
        message: 'Role changes affect portal access immediately, so confirm before promoting privileged accounts.',
        confirmText: 'Save Role',
        isDestructive: nextRole === 'super_admin',
      };
    default:
      return {
        title: 'Confirm action',
        message: 'Please confirm this account action.',
        confirmText: 'Continue',
        isDestructive: false,
      };
  }
}

export default function Accounts() {
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(emptyConfirmState);

  const { user: currentUser, startImpersonation, isImpersonating, stopImpersonation } = useAuth();
  const { addToast } = useToast();

  const currentUserId = currentUser?._id || currentUser?.id;
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const fetchUsers = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setLoadError('We could not load account data right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const normalizedStatus = user.status || 'active';
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  const stats = useMemo(() => {
    const activeUsers = users.filter((user) => (user.status || 'active') === 'active').length;
    const privilegedUsers = users.filter((user) => ['admin', 'super_admin'].includes(user.role)).length;
    const restrictedUsers = users.filter((user) => ['locked', 'suspended'].includes(user.status || 'active')).length;
    return {
      total: users.length,
      active: activeUsers,
      privileged: privilegedUsers,
      restricted: restrictedUsers,
    };
  }, [users]);

  const openRoleChange = (user: AccountUser, newRole: UserRole) => {
    if (user.role === newRole) return;
    setConfirmAction({ isOpen: true, action: 'role', user, nextRole: newRole });
  };

  const handleExecuteAction = async () => {
    const { action, user, nextRole } = confirmAction;
    if (!user || !action) return;

    setIsSubmittingAction(true);
    try {
      if (action === 'delete') {
        await api.delete(`/auth/users/${user._id}`);
        addToast('success', `${user.displayName || user.email} was deleted.`);
      } else if (action === 'lock') {
        await api.put(`/auth/users/${user._id}/status`, { status: 'locked' });
        addToast('success', `${user.displayName || user.email} was locked.`);
      } else if (action === 'suspend') {
        await api.put(`/auth/users/${user._id}/status`, { status: 'suspended' });
        addToast('success', `${user.displayName || user.email} was suspended.`);
      } else if (action === 'activate') {
        await api.put(`/auth/users/${user._id}/status`, { status: 'active' });
        addToast('success', `${user.displayName || user.email} was reactivated.`);
      } else if (action === 'reset-password') {
        await sendUserPasswordReset(user._id);
        addToast('success', `Password reset email sent to ${user.displayName || user.email}.`);
      } else if (action === 'role' && nextRole) {
        await api.put(`/auth/users/${user._id}/role`, { role: nextRole });
        addToast('success', `${user.displayName || user.email} is now ${nextRole.replace('_', ' ')}.`);
      }

      await fetchUsers();
    } catch (error) {
      console.error(`Failed to execute ${action} action`, error);
      addToast('error', `Failed to ${action} account. Please try again.`);
    } finally {
      setIsSubmittingAction(false);
      setConfirmAction(emptyConfirmState);
    }
  };

  const handleImpersonate = async (targetUser: AccountUser) => {
    try {
      const response = await api.post(`/auth/users/${targetUser._id}/impersonate`);
      addToast('info', `Impersonating ${targetUser.displayName || targetUser.email}.`);
      startImpersonation(response.data.token, response.data.user);
    } catch (error) {
      console.error('Failed to start impersonation', error);
      addToast('error', 'Failed to start impersonation.');
    }
  };

  const actionCopy = getActionCopy(confirmAction.action, confirmAction.user, confirmAction.nextRole);

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Manage Accounts"
        description="Review access, role assignments, and account health without mixing routine edits with risky security actions."
        action={
          <button
            type="button"
            onClick={fetchUsers}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
          >
            <RefreshCcw size={16} />
            Refresh Accounts
          </button>
        }
      />

      {isImpersonating ? (
        <Card className="mb-6 border-blue-200 bg-blue-50/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">Impersonation is active</p>
                <p className="mt-1 text-sm text-blue-800">
                  You are viewing the portal as another account. Exit impersonation before making privileged admin changes.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={stopImpersonation}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Stop Impersonating
            </button>
          </div>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users size={24} />} label="Total Accounts" value={stats.total} tone="slate" />
        <StatCard icon={<UserCheck size={24} />} label="Active Accounts" value={stats.active} tone="emerald" />
        <StatCard icon={<ShieldCheck size={24} />} label="Privileged Users" value={stats.privileged} tone="blue" />
        <StatCard icon={<Lock size={24} />} label="Restricted Accounts" value={stats.restricted} tone="amber" />
      </div>

      <Card noPadding>
        <Toolbar>
          <div className="w-full space-y-1">
            <SectionHeader
              title="Registered Users"
              description="Search quickly, narrow by role or status, and keep high-risk account actions clearly separated."
            />
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-3">
            <div className="relative min-w-0 xl:min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All roles</option>
              <option value="user">Mobile Users</option>
              <option value="staff">Staff</option>
              <option value="admin">Admins</option>
              <option value="super_admin">Super Admins</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | UserStatus)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="locked">Locked</option>
            </select>
          </div>
        </Toolbar>

        <div className="p-4 sm:p-5 lg:p-6">
          {loading ? <LoadingState message="Loading account directory..." /> : null}

          {!loading && loadError ? (
            <ErrorState
              title="Unable to load accounts"
              message={loadError}
              onRetry={fetchUsers}
            />
          ) : null}

          {!loading && !loadError && filteredUsers.length === 0 ? (
            <EmptyState
              title="No matching accounts"
              message="Try clearing one of the filters or searching for a different name or email."
            />
          ) : null}

          {!loading && !loadError && filteredUsers.length > 0 ? (
            <div className="space-y-4">
              {filteredUsers.map((user) => {
                const userStatus = user.status || 'active';
                const isCurrentUser = user._id === currentUserId;
                const canManageSuperAdmin = isSuperAdmin || user.role !== 'super_admin';
                const canEditRole = !isCurrentUser && canManageSuperAdmin;
                const canDelete = !isCurrentUser && canManageSuperAdmin;
                const roleChoices = isSuperAdmin
                  ? roleOptions
                  : roleOptions.filter((option) => option.value !== 'super_admin');

                return (
                  <Card key={user._id} className="border-slate-200">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 font-bold text-slate-600">
                              {user.displayName ? user.displayName.charAt(0).toUpperCase() : <Users size={18} />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="truncate text-base font-bold text-slate-800">
                                  {user.displayName || 'Unknown User'}
                                </h2>
                                {isCurrentUser ? <Badge variant="info">You</Badge> : null}
                              </div>
                              <p className="truncate text-sm font-medium text-slate-500">{user.email}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge variant={getStatusVariant(userStatus)}>{userStatus}</Badge>
                            <Badge variant={user.role === 'super_admin' ? 'info' : user.role === 'admin' ? 'warning' : 'default'}>
                              {user.role.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,240px)_1fr]">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Role Access</p>
                            <p className="mt-2 text-sm text-slate-600">
                              Use role changes carefully. Promotions change portal visibility immediately.
                            </p>
                            <select
                              value={user.role}
                              onChange={(e) => openRoleChange(user, e.target.value as UserRole)}
                              disabled={!canEditRole}
                              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {roleChoices.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {!canEditRole ? (
                              <p className="mt-2 text-xs text-slate-500">
                                {isCurrentUser
                                  ? 'You cannot change your own role here.'
                                  : 'This account requires super admin privileges to modify.'}
                              </p>
                            ) : null}
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                  Account Controls
                                </p>
                                <p className="mt-2 text-sm text-slate-600">
                                  Routine support actions stay separate from destructive actions to reduce accidental clicks.
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                              {isSuperAdmin && !isCurrentUser ? (
                                <button
                                  type="button"
                                  onClick={() => handleImpersonate(user)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                                >
                                  <UserCog size={16} />
                                  Log In As User
                                </button>
                              ) : null}

                              {!isCurrentUser && canManageSuperAdmin ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmAction({ isOpen: true, action: 'reset-password', user })}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
                                  >
                                    <Key size={16} />
                                    Send Password Reset
                                  </button>
                                  {userStatus === 'active' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmAction({ isOpen: true, action: 'suspend', user })}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                                      >
                                        <AlertTriangle size={16} />
                                        Suspend Access
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmAction({ isOpen: true, action: 'lock', user })}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                      >
                                        <Lock size={16} />
                                        Lock Account
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmAction({ isOpen: true, action: 'activate', user })}
                                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                    >
                                      <UserCheck size={16} />
                                      Reactivate Account
                                    </button>
                                  )}
                                </>
                              ) : null}
                            </div>

                            <div className="mt-5 border-t border-slate-100 pt-4">
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-500">Danger Zone</p>
                              <p className="mt-2 text-sm text-slate-600">
                                Permanent removal is intentionally isolated from routine access changes.
                              </p>
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ isOpen: true, action: 'delete', user })}
                                disabled={!canDelete}
                                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                              >
                                <Trash2 size={16} />
                                Delete Account
                              </button>
                              {!canDelete ? (
                                <p className="mt-2 text-xs text-slate-500">
                                  {isCurrentUser
                                    ? 'You cannot delete your own active session here.'
                                    : 'This account requires super admin privileges to delete.'}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : null}
        </div>
      </Card>

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        title={actionCopy.title}
        message={actionCopy.message}
        confirmText={isSubmittingAction ? 'Working...' : actionCopy.confirmText}
        isDestructive={actionCopy.isDestructive}
        onConfirm={handleExecuteAction}
        onCancel={() => (!isSubmittingAction ? setConfirmAction(emptyConfirmState) : undefined)}
      />
    </div>
  );
}
