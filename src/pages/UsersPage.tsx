import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CouncilUser } from '../types';
import { ShieldAlert, UserPlus, X, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const { isSuperAdmin, user } = useAuth();
  const [users, setUsers] = useState<CouncilUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin');
  const [adding, setAdding] = useState(false);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <ShieldAlert size={48} className="mb-4" />
        <h2 className="text-xl font-bold text-gray-600">Access Restricted</h2>
        <p className="text-sm mt-1">Only Super Admins can manage users.</p>
      </div>
    );
  }

  const fetchUsers = async () => {
    const { data } = await supabase.from('council_users').select('*').order('created_at');
    setUsers((data as CouncilUser[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleActive = async (u: CouncilUser) => {
    if (u.id === user?.id) { toast.error("Can't deactivate yourself"); return; }
    const { error } = await supabase.from('council_users').update({ is_active: !u.is_active }).eq('id', u.id);
    if (error) { toast.error('Failed'); return; }
    toast.success(u.is_active ? 'User deactivated' : 'User activated');
    fetchUsers();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">Manage council access</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-maroon flex items-center gap-2">
          <UserPlus size={16} /> Add User
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Last Login</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No users yet.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: u.avatar_color }}>
                      {u.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    {u.full_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.role === 'super_admin' ? 'bg-maroon-100 text-maroon-700' : 'bg-blue-100 text-blue-700'}`}>
                      {u.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.last_login ? formatDistanceToNow(new Date(u.last_login), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={u.id === user?.id}
                      className={`text-xs font-medium ${u.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'} disabled:opacity-30`}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add user modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add Council User</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <input value={newName} onChange={e => setNewName(e.target.value)} className="input-field" placeholder="Full Name" />
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} className="input-field" placeholder="Email" type="email" />
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="input-field">
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <p className="text-xs text-gray-400">Note: The user must first be created in Supabase Auth. Then enter their auth UUID manually via SQL.</p>
              <button onClick={() => { toast('User creation requires Supabase Auth setup first'); setShowAdd(false); }} disabled={adding} className="btn-maroon w-full flex items-center justify-center gap-2">
                {adding && <Loader2 size={14} className="animate-spin" />}
                Add User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
