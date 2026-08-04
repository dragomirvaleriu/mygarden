import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface VersionInfo {
  version: number;
  commit?: string;
}

declare global {
  interface Window {
    __APP_VERSION__?: VersionInfo;
  }
}

const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes — within the 5-10min window
// Brief courtesy heads-up before the automatic reload fires — long enough to
// notice, short enough that this still reads as "automatic", not "asking
// permission". No click required; this is not a countdown the user can
// cancel, just a beat so the page doesn't vanish with zero warning.
const AUTO_UPDATE_DELAY = 1800;

const fetchVersion = async (): Promise<VersionInfo | null> => {
  try {
    // `cache: 'no-store'` bypasses the browser's HTTP cache outright — the
    // `?t=` cache-buster plus firebase.json's no-cache header on
    // /version.json already cover this, but belt-and-suspenders costs
    // nothing here and protects against any CDN/proxy in between.
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch version.json:', err);
    return null;
  }
};

export const VersionChecker: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<VersionInfo | null>(null);
  const triggeredRef = useRef(false);

  useEffect(() => {
    fetchVersion().then((data) => {
      if (!data) return;
      window.__APP_VERSION__ = data;
      setCurrentVersion(data);
    });
  }, []);

  useEffect(() => {
    if (!currentVersion) return;

    const checkForUpdates = async () => {
      const data = await fetchVersion();
      if (data && (data.version !== currentVersion.version || data.commit !== currentVersion.commit)) {
        setHasUpdate(true);
      }
    };

    const interval = setInterval(checkForUpdates, POLLING_INTERVAL);

    // Both listeners cover "user comes back to an already-open tab" —
    // `focus` for a desktop window/tab switch, `visibilitychange` for the
    // mobile/PWA case where the tab never loses window focus but does go
    // to background (app-switcher, phone lock).
    const handleFocus = () => checkForUpdates();
    const handleVisibility = () => { if (document.visibilityState === 'visible') checkForUpdates(); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
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

      // Deliberately NOT touching localStorage/sessionStorage: everything
      // this app keeps there (read-article progress, ph logs, mowing
      // reminders, remembered email) is real user data, not a fetched-data
      // cache — there's nothing stale in it a new deploy would invalidate.
      // Firebase Auth itself persists via IndexedDB, not localStorage, so
      // it's untouched either way — the user stays logged in.
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
