import React, { useState, useEffect, useCallback } from 'react';
import {
  getVerificationReports,
  getVerificationStats,
  getVerificationSettings,
  updateVerificationSettings,
  getUsers,
  createUser,
  deleteUser,
} from '../services/api';

interface AdminDashboardProps {
  token: string;
  onLogout: () => void;
}

type Tab = 'reports' | 'stats' | 'settings' | 'users';

// ── Reports Tab ──────────────────────────────────────────────────────────
function ReportsTab({ token }: { token: string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterVerified, setFilterVerified] = useState<string>('');
  const [filterPin, setFilterPin] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters: any = {};
      if (filterVerified !== '') filters.verified = filterVerified === 'true';
      if (filterPin) filters.pinNumber = filterPin;
      const data = await getVerificationReports(token, page, 20, filters);
      setReports(data.reports);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, page, filterVerified, filterPin]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  function maskCardNumber(pin: string): string {
    if (!pin || pin.length < 4) return pin;
    return '***-*****-' + pin.slice(-1);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Verification Reports</h2>
        <span className="text-slate-400 text-sm">{total} total records</span>
      </div>

      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="Filter by card number..."
          value={filterPin}
          onChange={(e) => { setFilterPin(e.target.value); setPage(1); }}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 w-56"
        />
        <select
          value={filterVerified}
          onChange={(e) => { setFilterVerified(e.target.value); setPage(1); }}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Results</option>
          <option value="true">Verified</option>
          <option value="false">Failed</option>
        </select>
        <button
          onClick={fetchReports}
          className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-slate-400 font-medium px-5 py-3">Timestamp</th>
              <th className="text-left text-slate-400 font-medium px-5 py-3">Card Number</th>
              <th className="text-left text-slate-400 font-medium px-5 py-3">Type</th>
              <th className="text-left text-slate-400 font-medium px-5 py-3">Result</th>
              <th className="text-left text-slate-400 font-medium px-5 py-3">Transaction ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center text-slate-400 py-8">Loading...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-slate-400 py-8">No reports found</td></tr>
            ) : (
              reports.map((r) => (
                <tr key={r._id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-3 text-slate-300">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-slate-300 font-mono">{maskCardNumber(r.pinNumber)}</td>
                  <td className="px-5 py-3 text-slate-300">{r.verificationType ?? 'kyc'}</td>
                  <td className="px-5 py-3">
                    {r.verified ? (
                      <span className="inline-flex items-center gap-1 bg-green-900/40 text-green-400 border border-green-700/50 text-xs px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-red-900/40 text-red-400 border border-red-700/50 text-xs px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">{r.transactionId ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-slate-400 text-sm">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stats Tab ────────────────────────────────────────────────────────────
function StatsTab({ token }: { token: string }) {
  const [stats, setStats] = useState<{ total: number; successful: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getVerificationStats(token)
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-slate-400">Loading stats...</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!stats) return null;

  const successRate = stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0;

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Verification Statistics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <p className="text-slate-400 text-sm font-medium mb-2">Total Verifications</p>
          <p className="text-4xl font-bold text-white">{stats.total.toLocaleString()}</p>
          <p className="text-slate-400 text-xs mt-2">All time</p>
        </div>
        <div className="bg-slate-800 border border-green-700/40 rounded-xl p-6">
          <p className="text-slate-400 text-sm font-medium mb-2">Successful</p>
          <p className="text-4xl font-bold text-green-400">{stats.successful.toLocaleString()}</p>
          <p className="text-green-600 text-xs mt-2">{successRate}% success rate</p>
        </div>
        <div className="bg-slate-800 border border-red-700/40 rounded-xl p-6">
          <p className="text-slate-400 text-sm font-medium mb-2">Failed</p>
          <p className="text-4xl font-bold text-red-400">{stats.failed.toLocaleString()}</p>
          <p className="text-red-600 text-xs mt-2">{100 - successRate}% failure rate</p>
        </div>
      </div>
    </div>
  );
}

// ── Settings Tab ─────────────────────────────────────────────────────────
function SettingsTab({ token }: { token: string }) {
  const [form, setForm] = useState({ apiBaseUrl: '', merchantCode: '', merchantKey: '', defaultVerificationType: 'kyc' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    getVerificationSettings(token)
      .then((s) => setForm({ apiBaseUrl: s.apiBaseUrl ?? '', merchantCode: s.merchantCode ?? '', merchantKey: s.merchantKey ?? '', defaultVerificationType: s.defaultVerificationType ?? 'kyc' }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateVerificationSettings(token, form);
      setSuccess('Settings saved successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-slate-400">Loading settings...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Verification Settings</h2>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-xl">
        <form onSubmit={handleSave} className="space-y-5">
          {error && <div className="bg-red-900/40 border border-red-500 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}
          {success && <div className="bg-green-900/40 border border-green-500 text-green-300 rounded-lg px-4 py-3 text-sm">{success}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">API Base URL</label>
            <input
              type="text"
              value={form.apiBaseUrl}
              onChange={(e) => setForm({ ...form, apiBaseUrl: e.target.value })}
              placeholder="https://api.example.com"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Merchant Code</label>
            <input
              type="text"
              value={form.merchantCode}
              onChange={(e) => setForm({ ...form, merchantCode: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Merchant Key</label>
            <input
              type="password"
              value={form.merchantKey}
              onChange={(e) => setForm({ ...form, merchantKey: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Verification Type</label>
            <select
              value={form.defaultVerificationType}
              onChange={(e) => setForm({ ...form, defaultVerificationType: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="kyc">KYC (with photo)</option>
              <option value="yes_no">Yes/No (match check)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Users Tab ────────────────────────────────────────────────────────────
function UsersTab({ token }: { token: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'mobile' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await getUsers(token);
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, [token]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await createUser(token, newUser);
      setShowModal(false);
      setNewUser({ username: '', password: '', role: 'mobile' });
      await loadUsers();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUser(token, id);
      setUsers((u) => u.filter((x) => x._id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Users</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Add User
        </button>
      </div>

      {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-slate-400 font-medium px-5 py-3">Username</th>
              <th className="text-left text-slate-400 font-medium px-5 py-3">Role</th>
              <th className="text-left text-slate-400 font-medium px-5 py-3">Created</th>
              <th className="text-left text-slate-400 font-medium px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center text-slate-400 py-8">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-slate-400 py-8">No users found</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u._id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-3 text-white font-medium">{u.username}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-purple-900/40 text-purple-400 border border-purple-700/50' : 'bg-blue-900/40 text-blue-400 border border-blue-700/50'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleDelete(u._id)}
                      className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-5">Add New User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              {createError && <div className="bg-red-900/40 border border-red-500 text-red-300 rounded-lg px-4 py-3 text-sm">{createError}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="mobile">Mobile</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg transition-colors font-semibold">
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────
export default function AdminDashboard({ token, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('reports');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'reports', label: 'Reports', icon: '📋' },
    { id: 'stats', label: 'Stats', icon: '📊' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'users', label: 'Users', icon: '👥' },
  ];

  return (
    <div className="min-h-screen flex bg-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Skyface V2</p>
              <p className="text-slate-400 text-xs">Admin Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {activeTab === 'reports' && <ReportsTab token={token} />}
        {activeTab === 'stats' && <StatsTab token={token} />}
        {activeTab === 'settings' && <SettingsTab token={token} />}
        {activeTab === 'users' && <UsersTab token={token} />}
      </main>
    </div>
  );
}
