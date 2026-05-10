import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, N8N_DISPATCH_URL } from '../lib/supabase';
import { Save, Eye, EyeOff, Loader2, ExternalLink, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { councilUser, user } = useAuth();

  // Password change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const handleChangePw = async () => {
    if (newPw.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { toast.error(error.message); setChangingPw(false); return; }
    toast.success('Password updated successfully');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setChangingPw(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your profile and system configuration</p>

      {/* Profile Section */}
      <div className="card p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Your Profile</h3>
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold"
            style={{ backgroundColor: councilUser?.avatar_color || '#8B0000' }}
          >
            {councilUser?.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{councilUser?.full_name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <span className={`badge ml-auto ${councilUser?.role === 'super_admin' ? 'bg-maroon-100 text-maroon-700' : 'bg-blue-100 text-blue-700'}`}>
            {councilUser?.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 rounded-lg p-4">
          <div>
            <span className="text-gray-500">User ID</span>
            <p className="font-mono text-xs text-gray-700 mt-0.5 truncate">{user?.id}</p>
          </div>
          <div>
            <span className="text-gray-500">Status</span>
            <p className="mt-0.5">
              <span className={`badge ${councilUser?.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {councilUser?.is_active ? 'Active' : 'Inactive'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Change Password</h3>
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              className="input-field pr-10"
              placeholder="New Password"
            />
            <button
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <input
            type={showPw ? 'text' : 'password'}
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            className="input-field"
            placeholder="Confirm New Password"
          />
          <button
            onClick={handleChangePw}
            disabled={changingPw || !newPw || !confirmPw}
            className="btn-maroon flex items-center gap-2"
          >
            {changingPw ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Update Password
          </button>
        </div>
      </div>

      {/* System Info */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">System Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Supabase Project</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value="https://spglhsnskcchtqzgkmss.supabase.co"
                className="input-field text-xs font-mono flex-1 bg-gray-50"
              />
              <button
                onClick={() => copyToClipboard('https://spglhsnskcchtqzgkmss.supabase.co', 'Supabase URL')}
                className="btn-outline p-2"
              >
                <Copy size={14} />
              </button>
              <a
                href="https://supabase.com/dashboard/project/spglhsnskcchtqzgkmss"
                target="_blank"
                rel="noreferrer"
                className="btn-outline p-2"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">n8n Dispatch URL</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={N8N_DISPATCH_URL}
                className="input-field text-xs font-mono flex-1 bg-gray-50"
              />
              <button
                onClick={() => copyToClipboard(N8N_DISPATCH_URL, 'n8n URL')}
                className="btn-outline p-2"
              >
                <Copy size={14} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Agent test runs are dispatched to this webhook</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500 space-y-1">
            <p><span className="font-medium text-gray-700">App Version:</span> 1.0.0</p>
            <p><span className="font-medium text-gray-700">Stack:</span> React + Supabase + n8n + Claude API</p>
            <p><span className="font-medium text-gray-700">Agents:</span> 6 (Reconciliation, Claims, Courier, Tax, Billing, Insights)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
