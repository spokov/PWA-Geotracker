import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { haversineDistance, MOVEMENT_THRESHOLD_METERS } from '@/lib/geo';
import { savePendingUpdate, getPendingUpdates, deletePendingUpdate, getPendingCount } from '@/lib/offline-db';
import { useAuth } from '@/contexts/AuthContext';

interface Coordinates {
  lat: number;
  lng: number;
}

export function useLocationTracking() {
  const { username, session } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Coordinates | null>(null);
  const [lastSentPosition, setLastSentPosition] = useState<Coordinates | null>(null);
  const [totalLogged, setTotalLogged] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<Coordinates | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const sendToServer = useCallback(
    async (lat: number, lng: number, timestamp: string) => {
      if (!username || !session) return false;
      try {
        const { error: insertError } = await supabase.from('location_logs').insert({
          username,
          latitude: lat,
          longitude: lng,
          timestamp,
        });
        if (insertError) throw insertError;
        setTotalLogged((prev) => prev + 1);
        return true;
      } catch {
        const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await savePendingUpdate({
          id: pendingId,
          latitude: lat,
          longitude: lng,
          timestamp,
          username,
        });
        await refreshPendingCount();
        return false;
      }
    },
    [username, session, refreshPendingCount]
  );

  const syncPendingUpdates = useCallback(async () => {
    if (!session) return;
    const pending = await getPendingUpdates();
    if (pending.length === 0) return;
    for (const update of pending) {
      try {
        const { error: insertError } = await supabase.from('location_logs').insert({
          username: update.username,
          latitude: update.latitude,
          longitude: update.longitude,
          timestamp: update.timestamp,
        });
        if (insertError) throw insertError;
        await deletePendingUpdate(update.id);
      } catch {
        break;
      }
    }
    await refreshPendingCount();
  }, [session, refreshPendingCount]);

  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCurrentPosition({ lat, lng });

      const last = lastSentRef.current;
      if (last) {
        const distance = haversineDistance(last.lat, last.lng, lat, lng);
        if (distance < MOVEMENT_THRESHOLD_METERS) return;
      }

      lastSentRef.current = { lat, lng };
      setLastSentPosition({ lat, lng });
      void sendToServer(lat, lng, new Date(pos.timestamp).toISOString());
    },
    [sendToServer]
  );

  const handleError = (err: GeolocationPositionError) => {
    const messages: Record<number, string> = {
      1: 'Location permission denied. Enable location access in your browser settings.',
      2: 'Position unavailable. Check your GPS or network connection.',
      3: 'Location request timed out.',
    };
    setError(messages[err.code] ?? err.message);
  };

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as Navigator).wakeLock.request('screen');
      }
    } catch {
      // Wake lock not available or denied — non-fatal
    }
  }, []);

  const startTracking = useCallback(async () => {
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device.');
      return;
    }
    await requestWakeLock();
    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 30000,
    });
    // Tell the service worker to keep alive in background
    navigator.serviceWorker?.controller?.postMessage('start-keepalive');
    setIsTracking(true);
  }, [handlePosition, requestWakeLock]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
    navigator.serviceWorker?.controller?.postMessage('stop-keepalive');
    setIsTracking(false);
    lastSentRef.current = null;
  }, []);

  // Sync pending updates when connection is restored or SW requests it
  useEffect(() => {
    const handleOnline = () => void syncPendingUpdates();
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'sync-pending') {
        void syncPendingUpdates();
      }
    };
    window.addEventListener('online', handleOnline);
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    if (navigator.onLine) void syncPendingUpdates();
    return () => {
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [syncPendingUpdates]);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isTracking && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isTracking, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => stopTracking, [stopTracking]);

  return {
    isTracking,
    currentPosition,
    lastSentPosition,
    totalLogged,
    pendingCount,
    error,
    startTracking,
    stopTracking,
    syncPendingUpdates,
    refreshPendingCount,
  };
}
