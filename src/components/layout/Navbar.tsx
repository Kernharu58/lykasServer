import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Command, LogOut, Menu, MessageSquare, Search, UserCircle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  onMenuClick: () => void;
}

const searchableRoutes = [
  { label: 'Dashboard', path: '/', keywords: 'home overview metrics kpi' },
  { label: 'Pets', path: '/pets', keywords: 'manage pets animals gallery status' },
  { label: 'Adoptions', path: '/adoptions', keywords: 'applications approve reject review' },
  { label: 'Fostering', path: '/fosters', keywords: 'trial foster health update' },
  { label: 'Adopters & Risk', path: '/adopters', keywords: 'risk blacklist profile adopter' },
  { label: 'Volunteers', path: '/shifts', keywords: 'shifts volunteers appointments' },
  { label: 'Events', path: '/events', keywords: 'calendar rsvp event drive' },
  { label: 'Donations', path: '/donations', keywords: 'payments donors finance' },
  { label: 'Health', path: '/health', keywords: 'baby book vaccination medical' },
  { label: 'Reports', path: '/reports', keywords: 'analytics exports charts' },
  { label: 'Live Chat', path: '/chat', keywords: 'messages conversations support' },
  { label: 'Settings', path: '/settings', keywords: 'shelter policy configuration' },
  { label: 'Accounts', path: '/accounts', keywords: 'users staff admin roles' },
  { label: 'Audit Logs', path: '/audit-logs', keywords: 'history audit security' },
];

export default function Navbar({ onMenuClick }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);

  const currentRoute = searchableRoutes.find((route) => route.path === location.pathname);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return searchableRoutes.slice(0, 6);
    return searchableRoutes.filter((route) => `${route.label} ${route.keywords}`.toLowerCase().includes(term)).slice(0, 8);
  }, [query]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
        setIsUserOpen(false);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const goTo = (path: string) => {
    navigate(path);
    setIsSearchOpen(false);
    setQuery('');
  };

  const roleLabel = user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Staff';

  return (
    <>
      <header className="sticky top-0 z-30 h-[60px] border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex h-full items-center gap-3 px-4 sm:px-6">
          <button
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="hidden text-xs font-bold uppercase tracking-wider text-slate-400 sm:block">CarePaws Admin</p>
            <h1 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">{currentRoute?.label || 'Dashboard'}</h1>
          </div>

          <button
            onClick={() => setIsSearchOpen(true)}
            className="hidden min-w-[280px] items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-white hover:border-slate-300 md:flex"
          >
            <span className="inline-flex items-center gap-2">
              <Search size={17} />
              Search pets, applications, users...
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-400">
              <Command size={12} /> K
            </span>
          </button>

          <button
            onClick={() => setIsSearchOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Open search"
          >
            <Search size={20} />
          </button>

          <button onClick={() => navigate('/notifications')} className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Notifications">
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" />
          </button>

          <button
            onClick={() => navigate('/chat')}
            className="hidden h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 sm:inline-flex"
            aria-label="Open live chat"
          >
            <MessageSquare size={20} />
          </button>

          <div className="relative">
            <button
              onClick={() => setIsUserOpen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <UserCircle size={20} className="text-emerald-700" />
              <span className="hidden max-w-[130px] truncate lg:inline">{user?.displayName || user?.email || 'Admin'}</span>
              <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-800 xl:inline">{roleLabel}</span>
              <ChevronDown size={16} />
            </button>

            {isUserOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 p-3">
                  <p className="font-extrabold text-slate-900">{user?.displayName || 'CarePaws Staff'}</p>
                  <p className="truncate text-sm text-slate-500">{user?.email}</p>
                  <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">{roleLabel}</span>
                </div>
                <button
                  onClick={() => {
                    setIsUserOpen(false);
                    navigate('/settings');
                  }}
                  className="mt-2 flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => {
                    setIsUserOpen(false);
                    logout();
                    navigate('/login');
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-rose-700 hover:bg-rose-50"
                >
                  <LogOut size={16} />
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {isSearchOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={() => setIsSearchOpen(false)}>
          <div className="mx-auto mt-20 max-w-2xl rounded-lg border border-slate-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-slate-100 p-4">
              <Search size={20} className="text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pets, applications, users, reports..."
                className="flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button onClick={() => setIsSearchOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close search">
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {results.map((route) => (
                <button
                  key={route.path}
                  onClick={() => goTo(route.path)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left hover:bg-emerald-50"
                >
                  <span>
                    <span className="block font-extrabold text-slate-800">{route.label}</span>
                    <span className="block text-xs text-slate-500">{route.keywords}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-400">{route.path}</span>
                </button>
              ))}
              {results.length === 0 && (
                <div className="p-8 text-center">
                  <p className="font-bold text-slate-800">No matches found</p>
                  <p className="mt-1 text-sm text-slate-500">Try searching for a module like pets, events, risk, or reports.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
