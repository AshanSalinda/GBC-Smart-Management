import React, { useState, useEffect } from 'react';
import { Users, Settings, Trash2, Loader2, Save, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { listUsers, setRole, deleteUser } from '../api/users';
import { getConfig, updateConfig } from '../api/configs';

// --- User Management Component ---
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingUser, setUpdatingUser] = useState(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await listUsers();
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (uid, newRole) => {
    try {
      setUpdatingUser(uid);
      await setRole(uid, newRole);
      // Update local state to reflect change instantly
      setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Failed to update role:', err);
      alert('Failed to update user role.');
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleDelete = async (uid, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${name || 'this user'}?`)) return;
    try {
      setUpdatingUser(uid);
      await deleteUser(uid);
      setUsers(users.filter(u => u.uid !== uid));
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user.');
    } finally {
      setUpdatingUser(null);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (error) return <div className="text-danger p-6 text-center">{error}</div>;

  return (
    <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="p-4 font-semibold text-text-dim text-sm uppercase tracking-wider w-full">User</th>
              <th className="p-4 font-semibold text-text-dim text-sm uppercase tracking-wider text-center whitespace-nowrap">Joined</th>
              <th className="p-4 font-semibold text-text-dim text-sm uppercase tracking-wider text-center whitespace-nowrap">Role Access</th>
              <th className="p-4 font-semibold text-text-dim text-sm uppercase tracking-wider text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((user) => (
              <tr key={user.uid} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'User'} className="w-10 h-10 rounded-full border border-accent/20 object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent/20 to-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate">{user.displayName || 'Unnamed User'}</div>
                      <div className="text-sm text-text-dim truncate">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-center text-sm text-white/70 whitespace-nowrap">
                  {new Date(user.creationTime).toLocaleDateString()}
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="relative inline-block w-44 text-left">
                      <select
                        value={user.role || ''}
                        onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                        disabled={updatingUser === user.uid}
                        className={`appearance-none w-full border font-bold text-[0.75rem] uppercase tracking-wider rounded-xl pl-4 pr-10 py-2.5 outline-none cursor-pointer transition-all disabled:opacity-50 disabled:cursor-wait shadow-sm
                          ${user.role === 'admin' ? 'bg-accent/10 border-accent/30 text-accent hover:border-accent/50 focus:ring-2 focus:ring-accent/20' :
                            user.role === 'staff' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20' :
                              user.role === 'tv' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20' :
                                'bg-warning/10 border-warning/30 text-warning hover:border-warning/50 focus:ring-2 focus:ring-warning/20'
                          }
                        `}
                      >
                        <option value="" className="bg-[#18181b] text-warning font-semibold">Unassigned</option>
                        <option value="staff" className="bg-[#18181b] text-blue-400 font-semibold">Staff</option>
                        <option value="admin" className="bg-[#18181b] text-accent font-semibold">Administrator</option>
                        <option value="tv" className="bg-[#18181b] text-purple-400 font-semibold">TV Display</option>
                      </select>
                      {/* Custom Arrow */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                    {/* Fixed Width Spinner Container to prevent layout jump */}
                    <div className="w-5 flex items-center justify-center">
                      {updatingUser === user.uid && <Loader2 className="w-5 h-5 animate-spin text-accent" />}
                    </div>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => handleDelete(user.uid, user.displayName || user.email)}
                    disabled={updatingUser === user.uid}
                    className="p-2 text-text-dim hover:text-danger hover:bg-danger/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete User"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="4" className="p-8 text-center text-text-dim">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Global Config Component ---
const GlobalConfig = () => {
  const [config, setConfig] = useState({ hourlyRate: '', venueStartTime: '', venueCloseTime: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        const data = await getConfig();
        if (data) {
          setConfig({
            hourlyRate: data.hourlyRate || '',
            venueStartTime: data.venueStartTime || '',
            venueCloseTime: data.venueCloseTime || '',
          });
        }
      } catch (err) {
        console.error('Failed to load config:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
    setSaveStatus(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSaveStatus(null);
      await updateConfig({
        hourlyRate: Number(config.hourlyRate),
        venueStartTime: config.venueStartTime,
        venueCloseTime: config.venueCloseTime,
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to save config:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;

  return (
    <div className="bg-[#18181b]/60 backdrop-blur-xl mx-auto border border-white/5 rounded-3xl p-8 shadow-2xl max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Club Operations</h2>
        <p className="text-text-dim text-sm">Manage global settings like pricing and operating hours. These settings affect all new bookings immediately.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-white/80 mb-2">Hourly Rate ($)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
            <input
              type="number"
              name="hourlyRate"
              value={config.hourlyRate}
              onChange={handleChange}
              required
              min="0"
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-3 pl-8 pr-4 outline-none focus:border-accent focus:bg-white/[0.02] transition-all"
            />
          </div>
          <p className="text-xs text-text-dim mt-2">The default billing rate applied to all tables per hour of play.</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-2">Opening Time</label>
            <input
              type="time"
              name="venueStartTime"
              value={config.venueStartTime}
              onChange={handleChange}
              required
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-accent focus:bg-white/[0.02] transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-2">Closing Time</label>
            <input
              type="time"
              name="venueCloseTime"
              value={config.venueCloseTime}
              onChange={handleChange}
              required
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-accent focus:bg-white/[0.02] transition-all"
            />
          </div>
        </div>

        <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between">
          <div>
            {saveStatus === 'success' && (
              <span className="flex items-center text-accent text-sm font-bold gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Settings Saved!
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center text-danger text-sm font-bold gap-2 animate-in fade-in">
                <ShieldAlert className="w-4 h-4" /> Save Failed
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-accent hover:bg-accent-bright text-[#151517] font-bold px-6 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-70"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

// --- Main Admin Container ---
export default function Admin() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="max-w-[1200px] mx-auto min-h-screen pb-20 animate-in fade-in duration-300">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight text-white mb-2 drop-shadow-sm">
          Admin Controls
        </h1>
        <p className="text-text-dim text-sm md:text-base font-medium tracking-wide">
          Manage system access and global club settings.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'users'
            ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
            : 'text-text-dim hover:bg-white/5'
            }`}
        >
          <Users className="w-4 h-4" /> User Management
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'config'
            ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
            : 'text-text-dim hover:bg-white/5'
            }`}
        >
          <Settings className="w-4 h-4" /> Global Settings
        </button>
      </div>

      {/* Content */}
      <div className="mt-4">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'config' && <GlobalConfig />}
      </div>
    </div>
  );
}
