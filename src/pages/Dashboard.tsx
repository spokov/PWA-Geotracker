import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import RouteMap from '@/components/RouteMap';
import type { LocationLog } from '@/types';
import {
  Play,
  Square,
  LogOut,
  MapPin,
  Crosshair,
  CloudOff,
  Cloud,
  Clock,
  Navigation,
  Wifi,
  WifiOff,
} from 'lucide-react';

export default function Dashboard() {
  const { username, signOut } = useAuth();
  const {
    isTracking,
    currentPosition,
    lastSentPosition,
    totalLogged,
    pendingCount,
    error,
    startTracking,
    stopTracking,
    refreshPendingCount,
  } = useLocationTracking();

  const [logs, setLogs] = useState<LocationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data, error: err } = await supabase
      .from('location_logs')
      .select('*')
      .order('timestamp', { ascending: true });
    if (!err && data) setLogs(data as LocationLog[]);
    setLoadingLogs(false);
  }, []);

  useEffect(() => {
    void fetchLogs();
    void refreshPendingCount();
  }, [fetchLogs, refreshPendingCount]);

  const handleToggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      void startTracking();
    }
  };

  const totalPoints = logs.length + totalLogged;
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/30">
            <MapPin className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">GeoTrack</h1>
            <p className="text-xs text-slate-400 leading-tight">{username}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
              isOnline ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Navigation className="w-5 h-5" />}
            label="Total Points"
            value={totalPoints.toString()}
            color="teal"
          />
          <StatCard
            icon={<Crosshair className="w-5 h-5" />}
            label="This Session"
            value={totalLogged.toString()}
            color="blue"
          />
          <StatCard
            icon={pendingCount > 0 ? <CloudOff className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
            label="Pending Sync"
            value={pendingCount.toString()}
            color={pendingCount > 0 ? 'amber' : 'green'}
          />
        </div>

        {/* Map */}
        <div className="flex-1 min-h-[300px] relative">
          <RouteMap logs={logs} currentPosition={currentPosition} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <Crosshair className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Tracking control + status */}
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-4 space-y-4">
          {/* Current position */}
          {(currentPosition || lastSentPosition) && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-500/15 shrink-0">
                <Crosshair className="w-4.5 h-4.5 text-teal-400" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">Last sent position</p>
                <p className="text-sm text-white font-mono truncate">
                  {lastSentPosition
                    ? `${lastSentPosition.lat.toFixed(5)}, ${lastSentPosition.lng.toFixed(5)}`
                    : currentPosition
                      ? `${currentPosition.lat.toFixed(5)}, ${currentPosition.lng.toFixed(5)} (waiting for movement)`
                      : '—'}
                </p>
              </div>
            </div>
          )}

          {/* Last log time */}
          {lastLog && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-700/40 shrink-0">
                <Clock className="w-4 h-4 text-slate-400" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">Last recorded</p>
                <p className="text-sm text-white truncate">
                  {new Date(lastLog.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Track button */}
          <button
            onClick={handleToggleTracking}
            disabled={loadingLogs}
            className={`w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all ${
              isTracking
                ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20'
                : 'bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/20'
            }`}
          >
            {isTracking ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </button>

          <p className="text-center text-xs text-slate-500">
            {isTracking
              ? 'Tracking active. Updates sent when you move more than 7 meters.'
              : 'Press start to begin recording your route.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'teal' | 'blue' | 'amber' | 'green';
}) {
  const colors = {
    teal: 'bg-teal-500/15 text-teal-400 border-teal-400/20',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-400/20',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-400/20',
    green: 'bg-green-500/15 text-green-400 border-green-400/20',
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <div className="flex items-center justify-center mb-1.5">{icon}</div>
      <p className="text-xl font-bold text-white text-center leading-tight">{value}</p>
      <p className="text-[10px] text-slate-400 text-center leading-tight mt-0.5">{label}</p>
    </div>
  );
}
