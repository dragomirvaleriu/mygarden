import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes
// Brief courtesy heads-up before the automatic reload fires — long enough to
// notice, short enough that this still reads as "automatic", not "asking
// permission". No click required; this is not a countdown the user can
// cancel, just a beat so the page doesn't vanish with zero warning.
const AUTO_UPDATE_DELAY = 1800;

export const VersionChecker: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const triggeredRef = useRef(false);

  useEffect(() => {
    const fetchInitialVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentVersion(data.version);
        }
      } catch (err) {
        console.error('Failed to fetch initial version:', err);
      }
    };

    fetchInitialVersion();
  }, []);

  useEffect(() => {
    if (currentVersion === null) return;

    const checkForUpdates = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.version && data.version !== currentVersion) {
            setHasUpdate(true);
          }
        }
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    };

    const interval = setInterval(checkForUpdates, POLLING_INTERVAL);

    const handleFocus = () => checkForUpdates();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentVersion]);

  const applyUpdate = async () => {
    try {
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // Clear all CacheStorage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
    } catch (err) {
      console.error('Failed to clear caches:', err);
    } finally {
      // Force a hard reload from server
      // @ts-ignore
      window.location.reload(true);
    }
  };

  // Fully automatic: no click required — the moment a new build is
  // detected, this fires on its own after the brief courtesy delay above.
  useEffect(() => {
    if (!hasUpdate || triggeredRef.current) return;
    triggeredRef.current = true;
    const timer = setTimeout(applyUpdate, AUTO_UPDATE_DELAY);
    return () => clearTimeout(timer);
  }, [hasUpdate]);

  if (!hasUpdate) return null;

  // Small non-blocking corner toast — not a modal the user has to act on.
  // The reload happens regardless of anything the user does here.
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-3 bg-bg-card border border-accent-color/30 rounded-2xl px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="w-8 h-8 shrink-0 bg-accent-color/10 rounded-full flex items-center justify-center">
        <RefreshCw className="w-4 h-4 text-accent-color animate-spin" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-black text-main uppercase tracking-wide">Versiune nouă</p>
        <p className="text-[11px] text-text-secondary font-medium">Se actualizează automat...</p>
      </div>
    </div>
  );
};
