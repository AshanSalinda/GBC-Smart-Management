import React, { useState, useEffect } from 'react';
import {
  Activity, Server, Thermometer, Wifi, HardDrive,
  RefreshCcw, AlertTriangle, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { hardwareApi } from '../api/hardware';

export default function HardwareStatus() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hardwareApi.getHealth();
      setHealthData(data);
    } catch (err) {
      console.error('Error fetching hardware health:', err);
      setError('Failed to connect to hardware endpoint or hardware is unresponsive.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const formatUptime = (ms) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const isOnline = healthData?.status === 'ONLINE';

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isOnline
              ? 'bg-accent/15 text-accent shadow-[0_0_15px_rgba(74,188,109,0.3)]'
              : 'bg-danger/15 text-danger shadow-[0_0_15px_rgba(240,82,82,0.3)]'
            }`}>
            <Activity size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-text-main flex items-center gap-3">
              Hardware Status
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${isOnline ? 'bg-accent text-[#0a0a0c]' : 'bg-danger text-white'
                }`}>
                {healthData?.status || (loading ? 'FETCHING' : 'OFFLINE')}
              </span>
            </h1>
            <p className="text-text-dim text-sm mt-1">
              Real-time telemetry and connection state for the main controller.
            </p>
          </div>
        </div>

        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-bg border border-border rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-card-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
          {loading ? 'Pinging...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-xl flex items-start gap-3">
          <ShieldAlert className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Telemetry Grid */}
      <h2 className="text-lg font-bold font-display text-text-main mt-4">Telemetry Metadata</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Memory */}
        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-3 text-text-dim">
            <HardDrive size={18} />
            <span className="font-semibold text-sm">Memory (Free Heap)</span>
          </div>
          {healthData?.metadata ? (
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-xl font-bold text-white">
                  {(healthData.metadata.freeHeap / 1024).toFixed(1)} KB
                </span>
                <span className="text-xs text-text-dim font-medium">
                  / {(healthData.metadata.heapSize / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="h-1.5 w-full bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-1000"
                  style={{ width: `${Math.min(100, (healthData.metadata.freeHeap / healthData.metadata.heapSize) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="h-10 bg-bg/50 animate-pulse rounded-lg" />
          )}
        </div>

        {/* Network */}
        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-3 text-text-dim">
            <Wifi size={18} />
            <span className="font-semibold text-sm">Network</span>
          </div>
          {healthData?.metadata ? (
            <div>
              <p className="text-xl font-bold text-white mb-1">{healthData.metadata.ssid}</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${healthData.metadata.rssi > -70 ? 'bg-accent' : 'bg-warning'}`} />
                <span className="text-xs font-medium text-text-dim">{healthData.metadata.rssi} dBm (RSSI)</span>
              </div>
            </div>
          ) : (
            <div className="h-10 bg-bg/50 animate-pulse rounded-lg" />
          )}
        </div>

        {/* Temperature */}
        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-3 text-text-dim">
            <Thermometer size={18} />
            <span className="font-semibold text-sm">Core Temp</span>
          </div>
          {healthData?.metadata ? (
            <div>
              <p className="text-xl font-bold text-white flex items-end gap-1">
                {healthData.metadata.temperature} <span className="text-sm font-medium text-text-dim mb-0.5">°C</span>
              </p>
              <p className="text-xs font-medium text-text-dim mt-1.5">ESP32 Internal Sensor</p>
            </div>
          ) : (
            <div className="h-10 bg-bg/50 animate-pulse rounded-lg" />
          )}
        </div>

        {/* System Info */}
        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-3 text-text-dim">
            <Server size={18} />
            <span className="font-semibold text-sm">System</span>
          </div>
          {healthData?.metadata ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim">Uptime:</span>
                <span className="text-white font-medium">{formatUptime(healthData.metadata.uptimeMillis)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim">IP:</span>
                <span className="text-white font-medium">{healthData.metadata.ipAddress}</span>
              </div>
            </div>
          ) : (
            <div className="h-10 bg-bg/50 animate-pulse rounded-lg" />
          )}
        </div>
      </div>

      {/* Table Sync Matrix */}
      <h2 className="text-lg font-bold font-display text-text-main mt-4">Table Synchronization Matrix</h2>
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-border">
                <th className="p-4 text-xs font-bold text-text-dim uppercase tracking-wider w-1/4">Table</th>
                <th className="p-4 text-xs font-bold text-text-dim uppercase tracking-wider w-1/4">Backend State</th>
                <th className="p-4 text-xs font-bold text-text-dim uppercase tracking-wider w-1/4">Hardware State</th>
                <th className="p-4 text-xs font-bold text-text-dim uppercase tracking-wider w-1/4 text-right">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {healthData?.tables ? (
                healthData.tables.map((table) => (
                  <tr key={table.tableId} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-white">Table {table.tableId}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${table.backendState === 'ON' ? 'bg-white/10 text-white' : 'bg-black/40 text-text-dim'
                        }`}>
                        {table.backendState}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${table.hardwareState === 'ON' ? 'bg-white/10 text-white' : 'bg-black/40 text-text-dim'
                        }`}>
                        {table.hardwareState}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {table.isSynced ? (
                        <div className="inline-flex items-center gap-1.5 text-accent bg-accent/10 px-2.5 py-1 rounded-full">
                          <CheckCircle2 size={14} />
                          <span className="text-xs font-bold">SYNCED</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-warning bg-warning/10 px-2.5 py-1 rounded-full">
                          <AlertTriangle size={14} />
                          <span className="text-xs font-bold">MISMATCH</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="p-4"><div className="h-5 bg-bg/50 animate-pulse rounded w-16" /></td>
                    <td className="p-4"><div className="h-5 bg-bg/50 animate-pulse rounded w-12" /></td>
                    <td className="p-4"><div className="h-5 bg-bg/50 animate-pulse rounded w-12" /></td>
                    <td className="p-4 flex justify-end"><div className="h-6 bg-bg/50 animate-pulse rounded-full w-20" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
