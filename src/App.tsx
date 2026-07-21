import { DataProvider } from './context/DataContext';

import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { VersionChecker } from '../components/VersionChecker';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { UserProfile, Page } from './types';
import {
  auth,
  onAuthStateChanged,
  db,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from '../services/firebase';
import { updateUserSettings, UserSettings } from '../services/settings';
import i18n from './i18n';
import { useTranslation } from 'react-i18next';
import { Loader2, X, ShieldAlert, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { Toaster } from 'react-hot-toast';
import { usePlan } from './hooks/usePlan';

// My Garden is homeowner-only. This shell carries just what a homeowner needs:
// auth + profile, theme/accent/language sync, maintenance mode, global
// announcement, offline toasts, hash routing and the page frame. All of the
// LandscapeOS B2B field-work machinery (active visits, work sessions, the
// finish-report modal, service types, auto-scheduling maintenance contracts,
// team chat) has been removed — see LandscapeOS for the business edition.
const CareCalendar = React.lazy(() => import('../pages/CareCalendar'));
const GardenJournal = React.lazy(() => import('../pages/GardenJournal'));

const PFDashboard = React.lazy(() => import('../pages/PFDashboard'));
const Academy = React.lazy(() => import('../pages/Academy').then(m => ({ default: m.Academy })));

import { AdBanner } from './components/AdBanner';
import Login from '../pages/Login';
import { APP_NAME } from './config/appVariant';

import DesktopSidebar from '../components/DesktopSidebar';
import MobileDock from '../components/MobileDock';
const PFTools = React.lazy(() => import('../pages/PFTools'));
const GardenSetup = React.lazy(() => import('../pages/GardenSetup').then(m => ({ default: m.GardenSetup })));
const AccountSettings = React.lazy(() => import('../pages/AccountSettings'));
const Explore = React.lazy(() => import('../pages/Explore'));

const App: React.FC = () => {
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const [currentPage, setCurrentPage] = useState<Page>(Page.Dashboard);
  const { subscriptionTier } = usePlan(user?.uid);

  const [systemConfig, setSystemConfig] = useState<any>({ maintenanceMode: false, announcement: '' });
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState<string | null>(() => localStorage.getItem('ls_dismissed_announcement'));

  // Online/Offline status toasts for PWA support.
  useEffect(() => {
    const handleOnline = () => {
      import('react-hot-toast').then(({ toast }) => {
        toast.success('Conexiune restabilită! Datele și modificările făcute offline se sincronizează automat în fundal.', {
          icon: '🌐',
          duration: 4000,
        });
      });
    };
    const handleOffline = () => {
      import('react-hot-toast').then(({ toast }) => {
        toast.error('Ești offline. Aplicația poate fi folosită în continuare, iar modificările vor fi salvate local și sincronizate automat la reconectare.', {
          icon: '🔌',
          duration: 6000,
        });
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isMaintenanceActive = useMemo(() => {
    if (!systemConfig.maintenanceMode) return false;
    if (systemConfig.maintenanceUntil) {
      const now = new Date();
      const until = systemConfig.maintenanceUntil.toDate ? systemConfig.maintenanceUntil.toDate() : new Date(systemConfig.maintenanceUntil);
      return now < until;
    }
    return true;
  }, [systemConfig.maintenanceMode, systemConfig.maintenanceUntil]);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    // Safety timeout: if Firebase doesn't respond in 15 seconds, show login anyway
    const safetyTimeout = setTimeout(() => {
      if (!isReady) {
        console.warn("App: Firebase auth listener timed out, forcing ready state");
        setIsReady(true);
        setLoading(false);
      }
    }, 15000);

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimeout);
      try {
        if (firebaseUser) {
          setUser(firebaseUser);

          // Update last login
          const loginUpdateRef = doc(db, 'users', firebaseUser.uid);
          updateDoc(loginUpdateRef, { lastLoginAt: serverTimestamp() }).catch(err => {
            // Silently fail if they don't have permission yet or document doesn't exist
            console.debug("Could not update lastLoginAt immediately", err);
          });

          // Set up settings listener
          const settingsRef = doc(db, 'user_settings', firebaseUser.uid);
          const settingsUnsub = onSnapshot(settingsRef, (snap) => {
            if (snap.exists()) {
              setUserSettings(snap.data() as UserSettings);
            } else {
              // Create default settings if they don't exist
              const defaults: UserSettings = {
                userId: firebaseUser.uid,
                themeDesktop: 'light',
                themeMobile: 'dark',
                accentColorDesktop: '#4A7C59',
                accentColorMobile: '#68B0AB'
              };
              setUserSettings(defaults);
            }
          });

          const profileRef = doc(db, 'users', firebaseUser.uid);
          profileUnsub = onSnapshot(profileRef, (profileSnap) => {
            if (profileSnap.exists()) {
              setProfile(profileSnap.data() as UserProfile);
            } else {
              setProfile((prev) => prev ? prev : null);
            }
          }, (err) => {
            console.error("Critical Profile Error:", err);
            setProfile(null);
          });

          // Clean up settings unsub too
          const originalProfileUnsub = profileUnsub;
          profileUnsub = () => {
            originalProfileUnsub();
            settingsUnsub();
          };
        } else {
          setUser(null);
          setProfile(null);
          setUserSettings(null);
          if (profileUnsub) {
            profileUnsub();
            profileUnsub = null;
          }
        }
      } catch (err) {
        console.error("Error in onAuthStateChanged callback:", err);
      } finally {
        // Give a tiny bit of time for theme to apply
        setTimeout(() => {
          setLoading(false);
          setIsReady(true);
        }, 500);
      }
    });
    return () => {
      unsub();
      if (profileUnsub) profileUnsub();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Sync theme + accent + language from profile/settings to the DOM.
  useEffect(() => {
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    const theme = isMobile ? (userSettings?.themeMobile || 'dark') : (userSettings?.themeDesktop || 'light');
    const accentColor = isMobile ? (userSettings?.accentColorMobile || profile?.accentColor) : (userSettings?.accentColorDesktop || profile?.accentColor);

    document.documentElement.setAttribute('data-theme', theme);

    if (accentColor) {
      document.documentElement.style.setProperty('--accent-color', accentColor);
    } else {
      document.documentElement.style.removeProperty('--accent-color');
    }

    if (profile?.language) {
      if (i18n.language !== profile.language) {
        i18n.changeLanguage(profile.language);
      }
    }
  }, [userSettings, profile?.accentColor, profile?.language]);

  // Organization + global system config listeners (weather address, accent
  // palette, maintenance mode, announcement).
  useEffect(() => {
    if (!profile?.organizationId) return;
    const orgId = profile.organizationId;

    const unsubOrg = onSnapshot(doc(db, 'organizations', orgId), (snap) => {
      if (snap.exists()) {
        setOrganization({ id: snap.id, ...snap.data() });
      }
    });

    const unsubSystem = onSnapshot(doc(db, 'system_config', 'global'), (snap) => {
      if (snap.exists()) {
        setSystemConfig(snap.data());
      }
    });

    return () => { unsubOrg(); unsubSystem(); };
  }, [profile?.organizationId]);

  // Maintenance auto-refresh timer: re-render once the maintenance window ends.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (systemConfig.maintenanceMode && systemConfig.maintenanceUntil) {
      const until = systemConfig.maintenanceUntil.toDate ? systemConfig.maintenanceUntil.toDate() : new Date(systemConfig.maintenanceUntil);
      const now = new Date();
      const diff = until.getTime() - now.getTime();

      if (diff > 0) {
        const timer = setTimeout(() => {
          setTick(prev => prev + 1);
        }, diff + 1000); // Add 1s buffer
        return () => clearTimeout(timer);
      }
    }
  }, [systemConfig.maintenanceMode, systemConfig.maintenanceUntil]);

  const toggleTheme = async () => {
    if (!user) return;
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    const currentTheme = isMobile ? (userSettings?.themeMobile || 'dark') : (userSettings?.themeDesktop || 'light');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    try {
      const newSettings = {
        ...userSettings,
        userId: user.uid,
        [isMobile ? 'themeMobile' : 'themeDesktop']: newTheme
      };
      await updateUserSettings(user.uid, newSettings);
      setUserSettings(newSettings as UserSettings);
    } catch (error) {
      console.error("Error updating theme:", error);
    }
  };

  const selectAccentColor = async (color: string) => {
    if (!user) return;
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    try {
      const newSettings = {
        ...userSettings,
        userId: user.uid,
        [isMobile ? 'accentColorMobile' : 'accentColorDesktop']: color
      };
      await updateUserSettings(user.uid, newSettings);
      setUserSettings(newSettings as UserSettings);

      // Also update legacy profile for compatibility
      await updateDoc(doc(db, 'users', user.uid), { accentColor: color });
    } catch (error) {
      console.error("Error updating accent color:", error);
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (Object.values(Page).includes(hash as Page)) {
        setCurrentPage(hash as Page);
      } else {
        setCurrentPage(Page.Dashboard);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page: Page) => {
    window.location.hash = page;
  };

  if (!isReady) return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center transition-colors duration-700 font-sans">
      <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700">
        <div className="relative w-[80px] h-[80px] mb-5">
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[var(--brand-green)] border-r-[var(--brand-green)] animate-[spin_1.5s_cubic-bezier(0.68,-0.55,0.265,1.55)_infinite]"></div>
          <div className="absolute top-[5px] left-[5px] right-[5px] bottom-[5px] rounded-full border-[3px] border-transparent border-b-[var(--brand-olive)] border-l-[var(--brand-olive)] animate-[spin_2s_cubic-bezier(0.68,-0.55,0.265,1.55)_infinite_reverse] opacity-80"></div>
          <img src="/logo.svg" alt="Logo" className="absolute top-[15px] left-[15px] w-[50px] h-[50px] object-contain animate-[bounce_3s_ease-in-out_infinite]" style={{ animation: 'float 3s ease-in-out infinite' }} />
        </div>

        <h2 className="m-0 text-[38px] tracking-[-1px] font-black leading-none">
          <span style={{ color: 'var(--brand-olive)', transition: 'color 0.3s' }}>{APP_NAME}</span>
        </h2>

        <p style={{ color: 'var(--text-secondary)' }} className="text-[10px] mt-3 font-black tracking-[0.15em] text-center transition-colors duration-300 uppercase">
          YOUR GARDEN,<br/>SMARTLY CARED FOR
        </p>
      </div>
    </div>
  );

  // Development mode: allow app to render without a logged‑in user.
  if (!user) {
    if (process.env.NODE_ENV === "development") {
      // Continue rendering; many components work without a profile.
    } else {
      return <Login onOnboarded={(p) => setProfile(p)} />;
    }
  }
  if (!profile?.organizationId) {
    return <Login onOnboarded={(p) => setProfile(p)} />;
  }

  // Maintenance Mode Protection
  if (isMaintenanceActive && profile?.email !== 'dragomirvaleriu@gmail.com') {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-6 text-center">
        <div className="max-w-md animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={40} />
          </div>
          <h1 className="text-3xl font-black text-main uppercase tracking-tighter mb-4">{t('Maintenance Mode')}</h1>
          <p className="text-text-secondary font-medium leading-relaxed">
            {t('The platform is currently being updated to provide you with a better experience. We will be back shortly!')}
          </p>
          {systemConfig.maintenanceUntil && (
            <div className="mt-4 p-3 bg-bg-card rounded-xl border border-border-color">
              <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest mb-1">{t('Estimated time remaining')}</p>
              <p className="text-sm font-bold text-main">
                Până la {format(systemConfig.maintenanceUntil.toDate ? systemConfig.maintenanceUntil.toDate() : new Date(systemConfig.maintenanceUntil), 'HH:mm dd/MM')}
              </p>
            </div>
          )}
          <div className="mt-8 pt-8 border-t border-border-color">
            <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{t('My Garden Team')}</p>
          </div>
        </div>
      </div>
    );
  }

  const isMobile = window.matchMedia('(pointer: coarse)').matches;
  const currentTheme = (isMobile ? (userSettings?.themeMobile || 'dark') : (userSettings?.themeDesktop || 'light')) as 'light' | 'dark';

  const renderPage = () => {
    if (!profile) return <Login onOnboarded={(p) => setProfile(p)} />;

    const commonProps = {
      organizationId: profile.organizationId,
      userRole: profile.role,
      userProfile: profile,
      accountType: 'PF' as const
    };

    return (
      <ErrorBoundary>
        <React.Suspense fallback={
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-accent-color" />
          </div>
        }>
        {(() => {
          switch (currentPage) {
            case Page.Dashboard:
              return <PFDashboard onNavigate={navigateTo} organizationId={profile.organizationId} userProfile={profile} accountType='PF' />;
            case Page.Tools:
              return <PFTools />;
            case Page.GardenSetup:
              return <GardenSetup />;
            case Page.Administration:
              return <AccountSettings userProfile={profile} onNavigate={navigateTo} subscriptionTier={subscriptionTier} />;
            case Page.CareCalendar: return <CareCalendar {...commonProps} />;
            case Page.GardenJournal: return <GardenJournal organizationId={profile.organizationId} onNavigate={navigateTo} userId={profile.uid} isPF={true} />;
            case Page.Gallery: return <GardenJournal organizationId={profile.organizationId} onNavigate={navigateTo} userId={profile.uid} isPF={true} />;
            case Page.Academy: return <Academy subscriptionTier={subscriptionTier} onNavigateToUpgrade={() => navigateTo(Page.Administration)} />;
            case Page.Explore: return <Explore organizationId={profile.organizationId} />;

            default: return <PFDashboard onNavigate={navigateTo} organizationId={profile.organizationId} userProfile={profile} accountType='PF' />;
          }
        })()}
        </React.Suspense>
      </ErrorBoundary>
    );
  };

  if (!profile) {
    return (
      <DataProvider organizationId={null}>
        <Login onOnboarded={(p) => setProfile(p)} />
        <Toaster position="bottom-right" />
      </DataProvider>
    );
  }

  return (
    <DataProvider organizationId={profile.organizationId}>
      <div id="root-container" className="flex flex-col md:flex-row min-h-screen w-full overflow-x-hidden bg-bg-main transition-colors duration-300 relative">
        <div className="hidden md:flex w-60 h-screen fixed left-0 top-0 flex-shrink-0 z-50 border-r border-border-color">
          <DesktopSidebar
            activePage={currentPage}
            onNavigate={navigateTo}
            theme={currentTheme as 'light' | 'dark'}
            onToggleTheme={toggleTheme}
            accentColors={organization?.accentColors || ['#4A7C59', '#68B0AB', '#3b82f6', '#a855f7', '#ef4444']}
            subscriptionTier={subscriptionTier}
            selectedAccentColor={profile.accentColor || '#4A7C59'}
            onSelectAccentColor={selectAccentColor}
            profile={profile}
            showSidebarAds={systemConfig.adsConfig?.sidebar ?? true}
          />
        </div>
        <main className="flex-1 md:ml-60 px-4 pt-[calc(max(env(safe-area-inset-top),16px))] pb-32 md:py-6 sm:px-6 md:px-6 min-w-0">
          <div className="max-w-7xl mx-auto w-full">
            {systemConfig.announcement && dismissedAnnouncement !== systemConfig.announcement && (
              <div className="mb-6 bg-accent-color p-3 rounded-xl shadow-lg shadow-accent-color/20 flex items-center gap-3 animate-in slide-in-from-top duration-500 relative group">
                <Zap size={18} className="text-white animate-pulse" />
                <p className="text-xs font-black text-white uppercase tracking-wider flex-1">
                  {systemConfig.announcement}
                </p>
                <button
                  onClick={() => {
                    setDismissedAnnouncement(systemConfig.announcement);
                    localStorage.setItem('ls_dismissed_announcement', systemConfig.announcement);
                  }}
                  className="p-1 hover:bg-white/20 rounded-lg text-white transition-all"
                  title={t('Hide')}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {(systemConfig.adsConfig?.main ?? true) && <AdBanner />}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full h-full"
              >
                <React.Suspense fallback={<div className="flex justify-center items-center w-full h-64"><Loader2 className="w-8 h-8 animate-spin text-accent-color" /></div>}>
                  {renderPage()}
                </React.Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <div
          className="md:hidden fixed left-0 right-0 z-50 pointer-events-none transform-gpu will-change-transform"
          style={{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          <MobileDock
            activePage={currentPage}
            onNavigate={navigateTo}
            profile={profile}
            subscriptionTier={subscriptionTier}
          />
        </div>

        <VersionChecker />
        <Toaster position="bottom-right" />
      </div>
    </DataProvider>
  );
};

export default App;
