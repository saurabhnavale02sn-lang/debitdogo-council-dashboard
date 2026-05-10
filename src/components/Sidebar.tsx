import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ScrollText, Users, ShieldCheck, Settings, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

const navItems = [
  { to: '/council', icon: LayoutDashboard, label: 'Council Overview', roles: ['super_admin', 'admin'] },
  { to: '/logs', icon: ScrollText, label: 'Run Logs', roles: ['super_admin', 'admin'] },
  { to: '/users', icon: Users, label: 'Users', roles: ['super_admin'] },
  { to: '/audit', icon: ShieldCheck, label: 'Audit Log', roles: ['super_admin'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['super_admin', 'admin'] },
];

export default function Sidebar() {
  const { councilUser, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = councilUser?.role || 'admin';
  const initials = councilUser?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

  const nav = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-xl font-extrabold text-maroon-400 tracking-tight">DebitDogo</h1>
        <p className="text-[11px] text-gray-500 font-medium tracking-widest uppercase mt-0.5">AI Council</p>
      </div>

      <div className="mx-4 border-t border-gray-800 mb-2" />

      {/* Nav links */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.filter(n => n.roles.includes(role)).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-maroon-700/20 text-maroon-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: councilUser?.avatar_color || '#8B0000' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{councilUser?.full_name}</p>
            <span className={`badge text-[10px] ${role === 'super_admin' ? 'bg-maroon-700/30 text-maroon-400' : 'bg-blue-900/30 text-blue-400'}`}>
              {role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
            </span>
          </div>
          <button onClick={signOut} className="text-gray-500 hover:text-red-400 transition-colors" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar rounded-lg text-white shadow-lg"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="w-[260px] h-full bg-sidebar" onClick={e => e.stopPropagation()}>
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-gray-400">
              <X size={20} />
            </button>
            {nav}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[220px] bg-sidebar flex-col fixed inset-y-0 left-0 z-30">
        {nav}
      </aside>
    </>
  );
}
