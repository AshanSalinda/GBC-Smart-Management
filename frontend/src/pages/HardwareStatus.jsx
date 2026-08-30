import React, { useState, useEffect } from 'react';
import {
  Server, ServerOff, Thermometer, Wifi, HardDrive,
  RefreshCcw, AlertTriangle, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { hardwareApi } from '../api/hardware';

const DynamicWifiIcon = ({ rssi, size = 28, className = "shrink-0" }) => {
  const signalLevel = rssi > -60 ? 4 : rssi > -70 ? 3 : rssi > -80 ? 2 : rssi > -90 ? 1 : 0;

  const opacityActive = 'opacity-100';
  const opacityInactive = 'opacity-20';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path
        d="M1.42 9a16 16 0 0 1 21.16 0"
        className={`transition-opacity duration-500 ${signalLevel >= 4 ? opacityActive : opacityInactive}`}
      />
      <path
        d="M5 12.55a11 11 0 0 1 14.08 0"
        className={`transition-opacity duration-500 ${signalLevel >= 3 ? opacityActive : opacityInactive}`}
      />
      <path
        d="M8.53 16.11a6 6 0 0 1 6.95 0"
        className={`transition-opacity duration-500 ${signalLevel >= 2 ? opacityActive : opacityInactive}`}
      />
      <line
        x1="12" y1="20" x2="12.01" y2="20"
        className={`transition-opacity duration-500 ${signalLevel >= 1 ? opacityActive : opacityInactive}`}
      />
    </svg>
  );
};

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
      setError(true);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              Hardware
            </h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${isOnline ? 'bg-accent/10 border-accent/20 text-accent' :
                (loading && !healthData) ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' :
                  'bg-danger/10 border-danger/20 text-danger'
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-accent animate-pulse' :
                  (loading && !healthData) ? 'bg-sky-400 animate-pulse' :
                    'bg-danger'
                }`} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {healthData?.status || (loading ? 'Connecting' : 'Offline')}
              </span>
            </div>
          </div>
          <p className="text-text-dim text-sm">
            Real-time telemetry and connection status.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-card/50 border border-border/80 hover:border-border rounded-xl text-[11px] font-bold uppercase tracking-widest text-text-dim hover:text-text-main transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin text-accent' : 'group-hover:rotate-180 transition-transform duration-500'} />
          {loading ? 'Pinging' : 'Refresh'}
        </button>
      </div>

      {error || (!healthData && !loading) ? (
        <div className="flex flex-col items-center justify-center flex-1 py-32 opacity-80">
          <ServerOff size={64} className="text-danger mb-6" />
          <h2 className="text-2xl font-semibold text-text-main mb-2">Hardware Offline</h2>
          <p className="text-text-dim text-center">
            Unable to establish a connection with the hardware.
          </p>
        </div>
      ) : !healthData ? (
        <div className="flex flex-col items-center justify-center flex-1 py-32">
          <RefreshCcw size={48} className="text-accent animate-spin mb-6" />
          <h2 className="text-xl font-medium text-text-main mb-2">Connecting...</h2>
        </div>
      ) : (
        <>
          {/* Telemetry Grid */}
          <h2 className="text-xl font-light tracking-tight text-text-main mt-6 mb-4">Telemetry Metadata</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Memory */}
            <div className="bg-card/50 border border-border/80 hover:border-border p-5 rounded-xl transition-colors flex flex-col gap-4 min-h-[185px]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-accent/10 text-accent rounded-lg">
                  <HardDrive size={16} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-text-dim">Memory</span>
              </div>
              <div>
                <div className="flex items-baseline gap-1 mb-2.5">
                  <span className="text-3xl font-light tracking-tight text-text-main">
                    {(healthData.metadata.freeHeap / 1024).toFixed(1)}
                  </span>
                  <span className="text-sm font-medium text-text-dim">KB</span>
                </div>
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-semibold text-text-dim mb-1.5">
                  <span>Free Heap</span>
                  <span>{(healthData.metadata.heapSize / 1024).toFixed(1)} KB Total</span>
                </div>
                <div className="h-1.5 w-full bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-text-dim/80 transition-all duration-1000"
                    style={{ width: `${Math.min(100, (healthData.metadata.freeHeap / healthData.metadata.heapSize) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Network */}
            <div className="bg-card/50 border border-border/80 hover:border-border p-5 rounded-xl transition-colors flex flex-col gap-4 min-h-[185px]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg">
                  <Wifi size={16} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-text-dim">Network</span>
              </div>
              <div className="flex flex-col items-center justify-center flex-1 pb-1">
                <DynamicWifiIcon rssi={healthData.metadata.rssi} size={40} className="mb-2 text-sky-400 shrink-0" />
                <p className="text-xl font-light tracking-tight text-text-main text-center w-full truncate px-2">{healthData.metadata.ssid}</p>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-text-dim mt-1">{healthData.metadata.rssi} dBm</p>
              </div>
            </div>

            {/* Temperature */}
            <div className="bg-card/50 border border-border/80 hover:border-border p-5 rounded-xl transition-colors flex flex-col gap-4 min-h-[185px]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-warning/10 text-warning rounded-lg">
                  <Thermometer size={16} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-text-dim">Core Temp</span>
              </div>
              <div>
                <div className="flex items-baseline gap-1 mb-2.5">
                  <span className="text-3xl font-light tracking-tight text-text-main">
                    {Number(healthData.metadata.temperature).toFixed(1)}
                  </span>
                  <span className="text-sm font-medium text-text-dim">°C</span>
                </div>
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-semibold text-text-dim mb-1.5">
                  <span>Status</span>
                  <span>{healthData.metadata.temperature > 70 ? 'Warning' : healthData.metadata.temperature > 50 ? 'Elevated' : 'Normal'}</span>
                </div>
                <div className="h-1.5 w-full bg-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${healthData.metadata.temperature > 70 ? 'bg-danger' : healthData.metadata.temperature > 50 ? 'bg-warning' : 'bg-text-dim/80'}`}
                    style={{ width: `${Math.min(100, (healthData.metadata.temperature / 100) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-card/50 border border-border/80 hover:border-border p-5 rounded-xl transition-colors flex flex-col gap-4 min-h-[185px]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
                  <Server size={16} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-text-dim">System Info</span>
              </div>
              <div className="flex flex-col justify-between h-full space-y-2 mt-1">
                <div className="flex justify-between items-center border-b border-border pb-2.5">
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-text-dim">Device</span>
                  <span className="text-sm font-light tracking-wide text-text-main">{healthData.metadata.deviceName || 'ESP32'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-2.5">
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-text-dim">IP Address</span>
                  <span className="text-sm font-light tracking-wide text-text-main">{healthData.metadata.ipAddress}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-text-dim">Uptime</span>
                  <span className="text-sm font-light tracking-wide text-text-main">{formatUptime(healthData.metadata.uptimeMillis)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table Sync Matrix */}
          <h2 className="text-xl font-light tracking-tight text-text-main mt-6 mb-4">Synchronization State</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {healthData.tables?.map((table) => (
              <div key={table.tableId} className="bg-card/50 border border-border/80 hover:border-border p-5 rounded-xl transition-colors">
                <div className="flex justify-between items-center mb-5">
                  <span className="text-sm font-semibold text-text-main">Table {table.tableId}</span>
                  {table.isSynced ? (
                    <div className="inline-flex items-center gap-1.5 text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                      <CheckCircle2 size={14} strokeWidth={3} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Synced</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-warning bg-warning/10 px-2 py-0.5 rounded-md">
                      <AlertTriangle size={14} strokeWidth={3} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Mismatch</span>
                    </div>
                  )}
                </div>

                <div className="relative flex items-center justify-between mt-2">
                  {/* Connection Line */}
                  <div className="absolute left-[38%] right-[38%] top-1/2 -translate-y-1/2 flex items-center justify-center z-0">
                    {table.isSynced ? (
                      <div className="flex items-center justify-between w-full gap-1 opacity-80">
                        <div className="h-[2px] w-full bg-accent/50 rounded-full" />
                        <div className="text-accent/80">
                          <CheckCircle2 size={18} strokeWidth={2.5} />
                        </div>
                        <div className="h-[2px] w-full bg-accent/50 rounded-full" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full gap-1 opacity-80">
                        <div className="h-[2px] w-full bg-warning/50 rounded-full" />
                        <div className="text-warning">
                          <AlertTriangle size={18} strokeWidth={2.5} />
                        </div>
                        <div className="h-[2px] w-full bg-warning/50 rounded-full" />
                      </div>
                    )}
                  </div>

                  {/* Backend Node */}
                  <div className={`relative flex flex-col items-center justify-center gap-1 h-14 w-[38%] bg-bg rounded-xl border z-10 transition-colors ${table.backendState === 'ON' ? 'border-border' : 'border-border/50'
                    }`}>
                    <span className="text-[9px] uppercase tracking-widest font-semibold text-text-dim">Cloud</span>
                    <span className={`text-xs font-bold ${!table.isSynced ? 'text-warning' : table.backendState === 'ON' ? 'text-text-main' : 'text-text-dim'}`}>
                      {table.backendState}
                    </span>
                  </div>

                  {/* Hardware Node */}
                  <div className={`relative flex flex-col items-center justify-center gap-1 h-14 w-[38%] bg-bg rounded-xl border z-10 transition-colors ${table.hardwareState === 'ON' ? 'border-border' : 'border-border/50'
                    }`}>
                    <span className="text-[9px] uppercase tracking-widest font-semibold text-text-dim">Hardware</span>
                    <span className={`text-xs font-bold ${!table.isSynced ? 'text-warning' : table.hardwareState === 'ON' ? 'text-text-main' : 'text-text-dim'}`}>
                      {table.hardwareState}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
