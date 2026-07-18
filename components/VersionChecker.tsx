import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const VersionChecker: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    
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
      setTimeout(() => {
        // Force a hard reload from server
        // @ts-ignore
        window.location.reload(true);
      }, 300);
    }
  };

  if (!hasUpdate) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-accent-color/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-accent-color/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <RefreshCw className={`w-10 h-10 text-accent-color ${isUpdating ? 'animate-spin' : 'animate-spin-slow'}`} />
        </div>
        <h2 className="text-2xl font-black text-main mb-3 uppercase tracking-tight">
          Actualizare Disponibilă
        </h2>
        <p className="text-text-secondary text-sm font-medium mb-8 leading-relaxed">
          Am lansat o nouă versiune a aplicației cu îmbunătățiri importante. Apasă butonul de mai jos pentru a o actualiza.
        </p>
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className={`w-full py-4 bg-accent-color hover:bg-accent-color/90 text-white font-black uppercase tracking-wider rounded-xl shadow-lg shadow-accent-color/20 transition-all flex items-center justify-center gap-2 ${isUpdating ? 'opacity-80 cursor-wait' : 'hover:scale-105 active:scale-95'}`}
        >
          <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
          {isUpdating ? 'Se actualizează...' : 'Actualizează Acum'}
        </button>
      </div>
    </div>
  );
};
