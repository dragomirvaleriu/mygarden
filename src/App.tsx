import { DataProvider } from './context/DataContext';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { VersionChecker } from '../components/VersionChecker';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { checkFutureVisitExists } from '../services/visitUtils';
import { Visit, ServiceType, UserProfile, Client, Page } from './types';
import { 
  auth, 
  onAuthStateChanged, 
  db, 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  writeBatch,
  orderBy,
  limit,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  handleFirestoreError,
  OperationType
} from '../services/firebase';
import { logger } from '../services/logger';
import { getUserSettings, updateUserSettings, UserSettings } from '../services/settings';
import i18n from './i18n';
import { useTranslation } from 'react-i18next';
import { Camera, Notebook, List, Loader2, CheckCircle2, X, ShieldAlert, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { compressImage } from '../utils/image';
import { checkUploadRateLimit, recordUploadAction } from '../utils/rateLimit';
import { queuePhoto, getQueuedPhotos, removeQueuedPhoto } from '../utils/offlineStorage';
import { Toaster } from 'react-hot-toast';
import { usePlan } from './hooks/usePlan';

import { BookingWidget } from '../components/BookingWidget';

const Dashboard = React.lazy(() => import('../pages/Dashboard'));
const Clients = React.lazy(() => import('../pages/Clients'));
const Schedule = React.lazy(() => import('../pages/Schedule'));
const Administration = React.lazy(() => import('../pages/Administration'));
const Registru = React.lazy(() => import('../pages/Registru'));
const ClientDetails = React.lazy(() => import('../pages/ClientDetails'));
const ClientForm = React.lazy(() => import('../pages/ClientForm'));
const ClientPortal = React.lazy(() => import('../pages/ClientPortal'));
const Equipment = React.lazy(() => import('../pages/Equipment'));
const Reports = React.lazy(() => import('../pages/Reports'));
const ServicesConfig = React.lazy(() => import('../pages/ServicesConfig'));
const Logs = React.lazy(() => import('../pages/Logs'));
const AuditTrail = React.lazy(() => import('../pages/AuditTrail'));
const SuperAdmin = React.lazy(() => import('../pages/SuperAdmin'));
const CareCalendar = React.lazy(() => import('../pages/CareCalendar'));
const GardenJournal = React.lazy(() => import('../pages/GardenJournal'));
const GardenGallery = React.lazy(() => import('../pages/GardenGallery'));

const PFDashboard = React.lazy(() => import('../pages/PFDashboard'));
const Academy = React.lazy(() => import('../pages/Academy').then(m => ({ default: m.Academy })));

import { AdBanner } from './components/AdBanner';
const EmployeeDashboard = React.lazy(() => import('../pages/EmployeeDashboard'));
import Login from '../pages/Login';

import { rescheduleOverdueVisits } from '../services/reschedule';
import DesktopSidebar from '../components/DesktopSidebar';
import MobileDock from '../components/MobileDock';
const PfClientFormWrapper = React.lazy(() => import('./components/PfClientFormWrapper').then(m => ({ default: m.PfClientFormWrapper })));
const PFTools = React.lazy(() => import('../pages/PFTools'));
const GardenSetup = React.lazy(() => import('../pages/GardenSetup').then(m => ({ default: m.GardenSetup })));

const App: React.FC = () => {
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isPortalView, setIsPortalView] = useState(false);
  const [isBookingView, setIsBookingView] = useState(false);
  const [bookingOrgId, setBookingOrgId] = useState('');
  const [members, setMembers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (profile?.organizationId) {
      const q = query(collection(db, 'users'), where('organizationId', '==', profile.organizationId));
      const unsub = onSnapshot(q, snap => {
        setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      });
      return () => unsub();
    }
  }, [profile?.organizationId]);

  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  useEffect(() => {
    if (!profile?.organizationId || !profile?.uid) return;

    // No server-side orderBy: this listener only needs to detect unread messages,
    // and ordering client-side avoids requiring a composite Firestore index
    // (mirrors TeamChat.tsx). The index still exists in firestore.indexes.json
    // for any ordered queries.
    const q = query(
      collection(db, 'team_messages'),
      where('organizationId', '==', profile.organizationId),
      limit(50)
  );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data());
      const unread = msgs.some(m => 
        (m.recipientId === null || m.recipientId === profile.uid) && 
        m.senderId !== profile.uid && 
        (!m.readBy || !m.readBy.includes(profile.uid))
        
  );
      setHasUnreadMessages(unread);
    });

    return () => unsubscribe();

  }, [profile?.organizationId, profile?.uid]);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash.startsWith('#client-portal/')) {
        setIsPortalView(true);
        setIsBookingView(false);
      } else if (window.location.hash.startsWith('#booking/')) {
        const orgId = window.location.hash.substring('#booking/'.length);
        setBookingOrgId(orgId);
        setIsBookingView(true);
        setIsPortalView(false);
      } else {
        setIsPortalView(false);
        setIsBookingView(false);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);

    // Online/Offline status toasts for PWA support
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
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [currentPage, setCurrentPage] = useState<Page>(Page.Dashboard);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  /*
  useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  });
  */
  
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const { subscriptionTier } = usePlan(user?.uid);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishNote, setFinishNote] = useState('');
  const [pendingSyncs, setPendingSyncs] = useState<number>(0);
  const [selectedServices, setSelectedServices] = useState<Record<string, {selected: boolean, quantity: string}>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentClientSuprafata, setCurrentClientSuprafata] = useState<number>(0);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [confirmationModal, setConfirmationModal] = useState<{ title: string; message: string; onConfirm: () => void | Promise<void>; requireMath?: boolean; } | null>(null);
  const [mathProblem, setMathProblem] = useState<{ num1: number; num2: number; answer: string; }>({ num1: 0, num2: 0, answer: '' });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, visit: Visit) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = Array.from(e.target.files);
    
    // Front-end rate limiting for Homeowners (PF)
    const limitCheck = checkUploadRateLimit(profile?.accountType, files.length);
    if (!limitCheck.allowed) {
      import('react-hot-toast').then(({ toast }) => {
        toast.error(limitCheck.errorMsg || 'Limită depășită!');
      });
      return;
    }

    if (!navigator.onLine) {
        setIsProcessing(true);
        try {
            for (const file of files) {
                await queuePhoto({
                    id: `${Date.now()}_${file.name}`,
                    visitId: visit.id,
                    clientId: visit.clientId,
                    organizationId: profile?.organizationId || '',
                    uid: profile?.uid || auth.currentUser?.uid || '',
                    file,
                    timestamp: Date.now()
                });
            }
            import('react-hot-toast').then(({ toast }) => {
                toast.success('Ești offline. Pozele au fost salvate și se vor încărca automat când revine conexiunea.');
            });
            setPendingSyncs(prev => prev + files.length);
        } catch (err) {
            console.error("Eroare la salvarea pozelor offline", err);
        } finally {
            setIsProcessing(false);
        }
        return;
    }
    
    setIsProcessing(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        const compressedFile = await compressImage(file);
        const storageRef = ref(storage, `uploads/${profile?.organizationId}/${profile?.uid || auth.currentUser?.uid}/${visit.clientId}/visits/${visit.id}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, compressedFile);
        const url = await getDownloadURL(storageRef);
        uploadedUrls.push(url);
      }

      const updatedPhotos = [...(visit.photos || []), ...uploadedUrls];

      // Update Visit
      const visitRef = doc(db, 'visits', visit.id);
      await updateDoc(visitRef, {
        photos: updatedPhotos
      });

      // Record successful upload count for rate limiting sliding window
      recordUploadAction(profile?.accountType, files.length);

      logger.log(t('Upload Success', { count: files.length }), "success");
    } catch (error: any) {
      logger.log(t('Upload Error', { message: error.message }), "error");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    getQueuedPhotos().then(photos => setPendingSyncs(photos.length)).catch(() => {});

    const syncOfflinePhotos = async () => {
      try {
        const queued = await getQueuedPhotos();
        if (queued.length === 0) return;
        
        setIsProcessing(true);
        import('react-hot-toast').then(({ toast }) => {
            toast.loading(`Se încarcă ${queued.length} poze restante...`, { id: 'offline-sync' });
        });

        const grouped = queued.reduce((acc, photo) => {
            if (!acc[photo.visitId]) acc[photo.visitId] = [];
            acc[photo.visitId].push(photo);
            return acc;
        }, {} as Record<string, typeof queued>);

        for (const [visitId, photos] of Object.entries(grouped)) {
            const uploadedUrls: string[] = [];
            const visitRef = doc(db, 'visits', visitId);
            const visitSnap = await getDoc(visitRef);
            
            for (const photo of photos) {
                try {
                    const compressedFile = await compressImage(photo.file);
                    const storageRef = ref(storage, `uploads/${photo.organizationId}/${photo.uid}/${photo.clientId}/visits/${visitId}/${photo.id}`);
                    await uploadBytes(storageRef, compressedFile);
                    const url = await getDownloadURL(storageRef);
                    uploadedUrls.push(url);
                    await removeQueuedPhoto(photo.id);
                    setPendingSyncs(prev => Math.max(0, prev - 1));
                } catch(e) {
                    console.error("Failed to upload queued photo", e);
                }
            }

            if (uploadedUrls.length > 0 && visitSnap.exists()) {
                const currentVisitData = visitSnap.data();
                const updatedPhotos = [...(currentVisitData.photos || []), ...uploadedUrls];
                await updateDoc(visitRef, { photos: updatedPhotos });
            }
        }

        import('react-hot-toast').then(({ toast }) => {
            toast.success(`Sincronizare finalizată!`, { id: 'offline-sync' });
        });
      } catch (err) {
        console.error("Eroare la sincronizarea offline", err);
      } finally {
        setIsProcessing(false);
      }
    };

    window.addEventListener('online', syncOfflinePhotos);
    return () => window.removeEventListener('online', syncOfflinePhotos);
  }, []);

  const [photoViewer, setPhotoViewer] = useState<string | null>(null);
  const [systemConfig, setSystemConfig] = useState<any>({ maintenanceMode: false, announcement: '' });
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState<string | null>(() => localStorage.getItem('ls_dismissed_announcement'));

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
                accentColorDesktop: '#f07d00',
                accentColorMobile: '#f07d00'
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
    return (
    ) => {
      unsub();
      if (profileUnsub) profileUnsub();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // *** FIX: Sincronizează tema și accentul din profil/setări cu DOM-ul ***
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

  useEffect(() => {
    if (profile?.organizationId && profile.role === 'admin') {

      // Trigger visit rescheduling on frontend load to ensure it runs even if cron was missed
      rescheduleOverdueVisits(profile.organizationId);

      // Run fertilizer migration ONCE
      if (localStorage.getItem('fert_migrated_v1') !== 'true') {
        import('./services/migrations').then(m => m.runFertilizerMigration(profile.organizationId, db)).catch(console.error);
        localStorage.setItem('fert_migrated_v1', 'true');
      }
    }
  }, [profile?.organizationId, profile?.role]);

  useEffect(() => {
    if (!profile?.organizationId) return;

    const orgId = profile.organizationId;
    const unsubActive = onSnapshot(query(collection(db, 'visits'), where('organizationId', '==', orgId), where('status', '==', 'Activ')), (snap) => {
      setActiveVisit(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as Visit);
    }, (err) => {
      console.error("Error in active visit listener:", err);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, 'visits');
      }
    });

    const unsubServices = onSnapshot(query(collection(db, 'service_types'), where('organizationId', '==', orgId)), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceType));
      items.sort((a, b) => (a.order || 0) - (b.order || 0));
      setServiceTypes(items);
    }, (err) => {
      console.error("Error in service types listener:", err);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, 'service_types');
      }
    });

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

    return (
    ) => { unsubActive(); unsubServices(); unsubOrg(); unsubSystem(); };
  }, [profile?.organizationId]);

  // Maintenance auto-refresh timer
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
        return (
    ) => clearTimeout(timer);
      }
    }
  }, [systemConfig.maintenanceMode, systemConfig.maintenanceUntil]);

  // Periodic check to auto-stop jobs 2 hours after schedule ends
  useEffect(() => {
    if (!profile?.organizationId || !organization?.endTime) return;
    
    const checkAndStopJobs = async () => {
      try {
        const [endH, endM] = organization.endTime.split(':').map(Number);
        const now = new Date();
        const stopTime = new Date();
        stopTime.setHours(endH + 2, endM, 0, 0);

        if (now > stopTime) {
          const q = query(
            collection(db, 'visits'), 
            where('organizationId', '==', profile.organizationId),
            where('status', '==', 'Activ')
            
  );
          const snap = await getDocs(q);
          if (snap.empty) return;

          for (const docSnap of snap.docs) {
             const visit = docSnap.data() as Visit;
             const startTime = visit.currentSessionStart?.toDate() || new Date();
             
             // Ensure end time is at least the logical stop time, or now if something weird
             let finalEndTime = stopTime;
             if (startTime > stopTime) finalEndTime = now;

             const duration = Math.round((finalEndTime.getTime() - startTime.getTime()) / 60000);

             await updateDoc(docSnap.ref, {
               status: 'Finalizat',
               completedAt: serverTimestamp(),
               currentSessionStart: null,
               workSessions: [
                 ...(visit.workSessions || []),
                 { start: Timestamp.fromDate(startTime), end: Timestamp.fromDate(finalEndTime), duration }
               ]
             });

             await addDoc(collection(db, 'client_history'), {
               clientId: visit.clientId,
               organizationId: profile.organizationId,
               visitId: docSnap.id,
               type: 'visit_completion',
               date: serverTimestamp(),
               startTime: Timestamp.fromDate(startTime),
               duration,
               performedBy: visit.assignedTo || 'system',
               performedByName: visit.assignedToName || 'System Auto-Stop',
               details: t('Finished after {{duration}} minutes', { duration }) + ' (Auto-Stop)'
             });

             // Auto Schedule Next Visit
             if (!visit.nextVisitScheduled) {
                const clientRef = doc(db, 'clients', visit.clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    const clientData = clientSnap.data() as any;
                    
                    let isMaintenance = clientData.contractType === 'maintenance';
                    let freq = clientData.maintenanceFrequency || 'weekly';

                    if (visit.propertyId) {
                         const propRef = doc(db, 'properties', visit.propertyId);
                         const propSnap = await getDoc(propRef);
                         if (propSnap.exists()) {
                             const pData = propSnap.data();
                             if (pData.contractType) {
                                 isMaintenance = pData.contractType === 'maintenance';
                                 freq = pData.maintenanceFrequency || 'weekly';
                             }
                         }
                    } else {
                         const propsQuery = query(collection(db, 'properties'), where('clientId', '==', visit.clientId));
                         const propsSnap = await getDocs(propsQuery);
                         const maintenanceProp = propsSnap.docs.map(d => d.data()).find(p => p.contractType === 'maintenance');
                         if (maintenanceProp) {
                             isMaintenance = true;
                             freq = maintenanceProp.maintenanceFrequency || 'weekly';
                         }
                    }

                    if (isMaintenance) {
                        let nextDate = new Date();
                        nextDate.setHours(0, 0, 0, 0);
                        let shouldSchedule = false;

                        switch (freq) {
                            case 'weekly': nextDate.setDate(nextDate.getDate() + 7); shouldSchedule = true; break;
                            case 'biweekly': nextDate.setDate(nextDate.getDate() + 14); shouldSchedule = true; break;
                            case 'monthly': nextDate.setDate(nextDate.getDate() + 28); shouldSchedule = true; break;
                        }

                        if (shouldSchedule) {
                            const startHours = startTime.getHours();
                            const startMinutes = startTime.getMinutes();
                            const formattedTime = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
                            nextDate.setHours(startHours, startMinutes, 0, 0);
                            
                            const hasFuture = await checkFutureVisitExists(visit.clientId, visit.propertyId || null);
                            
                            if (!hasFuture) {
                            await addDoc(collection(db, 'visits'), {
                                clientId: visit.clientId,
                                clientName: clientData.nume || 'Client',
                                clientAddress: visit.propertyAddress || clientData.adresa || '',
                                organizationId: profile.organizationId,
                                status: 'Programat',
                                data: format(nextDate, 'yyyy-MM-dd'),
                                oraProgramare: formattedTime,
                                tipLucrare: 'Mentenanță',
                                createdAt: serverTimestamp(),
                                propertyId: visit.propertyId || null,
                                propertyAddress: visit.propertyAddress || '',
                                propertyMapsLink: visit.propertyMapsLink || '',
                                detalii: 'Programare automată conform contractului de mentenanță (Auto-Stop)',
                                assignedTo: visit.assignedTo || '',
                                assignedToName: visit.assignedToName || ''
                            });
                            
                            }
                            
                            await updateDoc(docSnap.ref, { nextVisitScheduled: true });
                        }
                    }
                }
             }
          }
        }
      } catch (e) {
        console.error("Error auto-stopping jobs:", e);
      }
    };

    const interval = setInterval(checkAndStopJobs, 5 * 60 * 1000); // Check every 5 mins
    checkAndStopJobs(); // Check on mount

    return (
    ) => clearInterval(interval);
  }, [profile?.organizationId, organization?.endTime]);

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
      if (hash.startsWith('details/')) {
        setSelectedClientId(hash.split('/')[1]);
        setCurrentPage(Page.Details);
      } else if (hash.startsWith('client-form/')) {
        setSelectedClientId(hash.split('/')[1] === 'new' ? null : hash.split('/')[1]);
        setCurrentPage(Page.ClientForm);
      } else if (Object.values(Page).includes(hash as Page)) {
        setCurrentPage(hash as Page);
      } else {
        setCurrentPage(Page.Dashboard);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);

  }, []);

  const navigateTo = (page: Page, id?: string) => {
    window.location.hash = (page === Page.Details && id) ? `details/${id}` : (page === Page.ClientForm) ? `client-form/${id || 'new'}` : page;
  };

  const handleOpenGlobalStop = async () => {
    if (!activeVisit) return;
    setIsFinishModalOpen(true);
    setIsProcessing(true);
    try {
      const clientSnap = await getDoc(doc(db, 'clients', activeVisit.clientId));
      const clientData = clientSnap.exists() ? clientSnap.data() : {};
      
      // Fetch properties to calculate total surface area
      const propsQuery = query(
        collection(db, 'properties'), 
        where('clientId', '==', activeVisit.clientId),
        where('organizationId', '==', profile?.organizationId)
        
  );
      const propsSnap = await getDocs(propsQuery);
      const totalSurface = propsSnap.docs.reduce((sum, doc) => sum + (doc.data().surfaceArea || 0), 0);
      
      // Fallback to client data if no properties (backward compatibility)
      const suprafata = totalSurface > 0 ? totalSurface : (clientData.suprafataMp || 0);
      
      setCurrentClientSuprafata(suprafata);
      setFinishNote('');
      
      // Calculate current duration in hours
      const startTime = activeVisit.currentSessionStart?.toDate() || new Date();
      const now = new Date();
      const durationHours = ((now.getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(2);

      const initial: Record<string, any> = {};
      serviceTypes.forEach(st => {
        let quantity = '';
        const unit = (st.unit || '').toLowerCase();
        
        if (st.isDefault) {
          if (unit === 'm²' || unit === 'mp' || unit === 'm2') {
            quantity = suprafata.toString();
          } else if (unit === 'ora' || unit === 'ore' || unit === 'h') {
            quantity = durationHours;
          }
        }

        initial[st.id] = { 
          selected: st.isDefault, 
          quantity: quantity
        };
      });
      setSelectedServices(initial);
    } catch (err) { logger.log(t('Error fetching data'), "error"); }
    finally { setIsProcessing(false); }
  };

  const handleGlobalFinalize = useCallback(async () => {
    if (!activeVisit || isProcessing || !profile) return;
    setIsProcessing(true);
    try {
      const startTime = activeVisit.currentSessionStart?.toDate() || new Date();
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      
      // Filter selected services to ensure they exist in current serviceTypes
      const finalServices = (Object.entries(selectedServices) as [string, {selected: boolean, quantity: string}][])
        .filter(([id, val]) => val.selected && serviceTypes.some(st => st.id === id))
        .map(([id, val]) => {
          const st = serviceTypes.find(s => s.id === id);
          return { serviceId: id, name: st?.name || 'Serviciu', quantity: val.quantity ? Number(val.quantity) : undefined, unit: st?.unit };
        });

      // Update Visit
      await updateDoc(doc(db, 'visits', activeVisit.id), {
        status: 'Finalizat', 
        completedAt: serverTimestamp(), 
        currentSessionStart: null,
        workSessions: [...(activeVisit.workSessions || []), { start: Timestamp.fromDate(startTime), end: Timestamp.fromDate(endTime), duration }],
        servicii_efectuate: finalServices,
        finishNote: finishNote || null
      });

      // Save to Client History
      await addDoc(collection(db, 'client_history'), {
        clientId: activeVisit.clientId,
        organizationId: profile.organizationId,
        visitId: activeVisit.id,
        type: 'visit_completion',
        date: serverTimestamp(),
        startTime: Timestamp.fromDate(startTime),
        services: finalServices,
        duration,
        performedBy: profile.uid,
        performedByName: profile.displayName || profile.email,
        photos: activeVisit.photos || [],
        details: finishNote || null
      });

      // Automatic Scheduling Logic (Fallback for older visits)
      if (!activeVisit.nextVisitScheduled) {
        const clientRef = doc(db, 'clients', activeVisit.clientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
            const clientData = clientSnap.data() as any; // Cast to any to access new fields safely or import Client type fully
            
            let isMaintenance = clientData.contractType === 'maintenance';
            let freq = clientData.maintenanceFrequency || 'weekly';

            if (activeVisit.propertyId) {
                 const propRef = doc(db, 'properties', activeVisit.propertyId);
                 const propSnap = await getDoc(propRef);
                 if (propSnap.exists()) {
                     const pData = propSnap.data();
                     if (pData.contractType) {
                         isMaintenance = pData.contractType === 'maintenance';
                         freq = pData.maintenanceFrequency || 'weekly';
                     }
                 }
            } else {
                 const propsQuery = query(collection(db, 'properties'), where('clientId', '==', activeVisit.clientId));
                 const propsSnap = await getDocs(propsQuery);
                 const maintenanceProp = propsSnap.docs.map(d => d.data()).find(p => p.contractType === 'maintenance');
                 if (maintenanceProp) {
                     isMaintenance = true;
                     freq = maintenanceProp.maintenanceFrequency || 'weekly';
                 }
            }

            if (isMaintenance) {
                let nextDate = new Date();
                nextDate.setHours(0, 0, 0, 0); // Start of day normalization
                let shouldSchedule = false;

                switch (freq) {
                    case 'weekly':
                        nextDate.setDate(nextDate.getDate() + 7);
                        shouldSchedule = true;
                        break;
                    case 'biweekly':
                        nextDate.setDate(nextDate.getDate() + 14);
                        shouldSchedule = true;
                        break;
                    case 'monthly':
                        nextDate.setMonth(nextDate.getMonth() + 1);
                        shouldSchedule = true;
                        break;
                    case 'occasional':
                        shouldSchedule = false;
                        break;
                }

                if (shouldSchedule) {
                    // Use the start time of the current visit
                    const startHours = startTime.getHours();
                    const startMinutes = startTime.getMinutes();
                    const formattedTime = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
                    
                    nextDate.setHours(startHours, startMinutes, 0, 0);
                    
                    const hasFuture = await checkFutureVisitExists(activeVisit.clientId, activeVisit.propertyId || null);
                    
                    if (!hasFuture) {
                    await addDoc(collection(db, 'visits'), {
                        clientId: activeVisit.clientId,
                        clientName: clientData.nume || 'Client',
                        clientAddress: activeVisit.propertyAddress || clientData.adresa || '',
                        organizationId: profile.organizationId,
                        status: 'Programat',
                        data: format(nextDate, 'yyyy-MM-dd'),
                        oraProgramare: formattedTime,
                        tipLucrare: 'Mentenanță',
                        createdAt: serverTimestamp(),
                        propertyId: activeVisit.propertyId || null,
                        propertyAddress: activeVisit.propertyAddress || '',
                        propertyMapsLink: activeVisit.propertyMapsLink || '',
                        detalii: 'Programare automată conform contractului de mentenanță',
                        assignedTo: activeVisit.assignedTo || auth.currentUser?.uid || '',
                        assignedToName: activeVisit.assignedToName || auth.currentUser?.displayName || auth.currentUser?.email || ''
                    });
                    
                    await updateDoc(doc(db, 'visits', activeVisit.id), {
                      nextVisitScheduled: true
                    });
                    
                    logger.log(t('Auto Scheduled', { name: clientData.nume, date: format(nextDate, 'dd/MM/yyyy'), time: formattedTime }), "info");
                    }
                }
            }
        }
      }

      setIsFinishModalOpen(false);
      logger.log(t('Finalized', { name: activeVisit.clientName }), "success");
    } catch (err: any) { 
      console.error(err);
      alert(err.message); 
    }
    finally { setIsProcessing(false); }
  }, [activeVisit, isProcessing, selectedServices, serviceTypes, profile]);

  if (!isReady) return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center transition-colors duration-700 font-sans">
      <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700">
        <div className="relative w-[80px] h-[80px] mb-5">
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[var(--brand-green)] border-r-[var(--brand-green)] animate-[spin_1.5s_cubic-bezier(0.68,-0.55,0.265,1.55)_infinite]"></div>
          <div className="absolute top-[5px] left-[5px] right-[5px] bottom-[5px] rounded-full border-[3px] border-transparent border-b-[var(--brand-olive)] border-l-[var(--brand-olive)] animate-[spin_2s_cubic-bezier(0.68,-0.55,0.265,1.55)_infinite_reverse] opacity-80"></div>
          <img src="/logo.png" alt="Logo" className="absolute top-[15px] left-[15px] w-[50px] h-[50px] object-contain animate-[bounce_3s_ease-in-out_infinite]" style={{ animation: 'float 3s ease-in-out infinite' }} />
        </div>
        
        <h2 className="m-0 text-[38px] tracking-[-1px] font-black leading-none">
          <span style={{ color: 'var(--brand-olive)', transition: 'color 0.3s' }}>Scapeflow</span>
        </h2>
        
        <p style={{ color: 'var(--text-secondary)' }} className="text-[10px] mt-3 font-black tracking-[0.15em] text-center transition-colors duration-300 uppercase">
          LANDSCAPE FLOW<br/>MANAGEMENT
        </p>
      </div>
    </div>
  );

  if (isPortalView) {
    return <ClientPortal />;
  }

  if (isBookingView) {
    return <BookingWidget organizationId={bookingOrgId} />;
  }

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
            <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{t('Scapeflow Team')}</p>
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
      accountType: profile.accountType || 'PJ'
    };
    const isPF = profile.accountType === 'PF';
    
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
              if (isPF) return <PFDashboard onNavigate={navigateTo} organizationId={profile.organizationId} userProfile={profile} accountType='PF' />;
              return profile.role === 'admin' 
                ? <Dashboard onNavigate={navigateTo} {...commonProps} activeVisit={activeVisit} onStopWork={handleOpenGlobalStop} />
                : <EmployeeDashboard organizationId={profile.organizationId} onNavigate={navigateTo} />;
            case Page.Tools:
              return isPF ? <PFTools /> : <Dashboard onNavigate={navigateTo} {...commonProps} />;
            case Page.GardenSetup:
              return isPF ? <GardenSetup /> : <Dashboard onNavigate={navigateTo} {...commonProps} />;
            case Page.Clients: 
              return isPF 
                ? <PfClientFormWrapper onNavigate={navigateTo} {...commonProps} />
                : <Clients onNavigate={navigateTo} {...commonProps} />;
            case Page.Schedule: 
              return isPF ? <Dashboard onNavigate={navigateTo} {...commonProps} /> : <Schedule onNavigate={navigateTo} {...commonProps} />;
            case Page.Administration: return (
            profile.role === 'admin' || profile.role === 'employee') ? (
              <Administration 
                onNavigate={navigateTo} 
                {...commonProps} 
                theme={currentTheme as 'light' | 'dark'}
                onToggleTheme={toggleTheme}
                accentColors={organization?.accentColors || ['#f07d00', '#22c55e', '#3b82f6', '#a855f7', '#ef4444']}
                selectedAccentColor={profile.accentColor || '#f07d00'}
                onSelectAccentColor={selectAccentColor}
                profile={profile}
                subscriptionTier={subscriptionTier}
                userRole={profile.role}
                userSettings={userSettings}
                onUpdateUserSettings={async (s) => {
                  if (!user) return;
                  await updateUserSettings(user.uid, s);
                  setUserSettings(prev => ({ ...prev, ...s } as UserSettings));
                }}
              />
            ) : <Dashboard onNavigate={navigateTo} {...commonProps} />;
            case Page.Registru: 
              return isPF ? <Dashboard onNavigate={navigateTo} {...commonProps} /> : <Registru organizationId={profile.organizationId} onNavigate={navigateTo} />;
            case Page.Details: return <ClientDetails id={selectedClientId || ''} onNavigate={navigateTo} {...commonProps} />;
            case Page.ClientForm: return <ClientForm id={selectedClientId} onNavigate={navigateTo} {...commonProps} />;
            case Page.Services: 
              return isPF ? <Dashboard onNavigate={navigateTo} {...commonProps} /> : <ServicesConfig {...commonProps} onNavigate={navigateTo} />;
            case Page.ClientPortal: return <ClientPortal />;
            case Page.Equipment: return <Equipment organizationId={profile.organizationId} onNavigate={navigateTo} />;
            case Page.Reports: 
              return (profile.role === 'admin' && !isPF) ? <Reports organizationId={profile.organizationId} /> : <Dashboard onNavigate={navigateTo} {...commonProps} />;
            case Page.Logs: 
              return (profile.role === 'admin' && !isPF) ? <Logs organizationId={profile.organizationId} /> : <Dashboard onNavigate={navigateTo} {...commonProps} />;
            case Page.AuditTrail: 
              return (profile.role === 'admin' && !isPF) ? <AuditTrail organizationId={profile.organizationId} /> : <Dashboard onNavigate={navigateTo} {...commonProps} />;
            case Page.SuperAdmin: return profile.email === 'dragomirvaleriu@gmail.com' ? <SuperAdmin profile={profile} /> : <Dashboard onNavigate={navigateTo} {...commonProps} />;
            case Page.CareCalendar: return <CareCalendar {...commonProps} />;
            case Page.GardenJournal: return <GardenJournal organizationId={profile.organizationId} onNavigate={navigateTo} userId={profile.uid} isPF={isPF} />;
            case Page.Gallery: return isPF ? <GardenJournal organizationId={profile.organizationId} onNavigate={navigateTo} userId={profile.uid} isPF={true} /> : <GardenGallery organizationId={profile.organizationId} onNavigate={navigateTo} accountType={profile.accountType || 'PJ'} userId={profile.uid} />;
            case Page.Academy: return <Academy subscriptionTier={subscriptionTier} onNavigateToUpgrade={() => navigateTo(Page.Administration)} />;


            default: return <Dashboard onNavigate={navigateTo} {...commonProps} />;
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
      <>
      <div id="root-container" className="flex flex-col md:flex-row min-h-screen w-full overflow-x-hidden bg-bg-main transition-colors duration-300 relative">
      <div className="hidden md:flex w-60 h-screen fixed left-0 top-0 flex-shrink-0 z-50 border-r border-border-color">
        <DesktopSidebar 
          activePage={currentPage} 
          onNavigate={navigateTo} 
          theme={currentTheme as 'light' | 'dark'} 
          onToggleTheme={toggleTheme} 
          activeVisit={activeVisit} 
          onStopWork={handleOpenGlobalStop} 
          isAdmin={profile.role === 'admin'} 
          accentColors={organization?.accentColors || ['#f07d00', '#22c55e', '#3b82f6', '#a855f7', '#ef4444']}
          subscriptionTier={subscriptionTier}

          selectedAccentColor={profile.accentColor || '#f07d00'}
          onSelectAccentColor={selectAccentColor}
          profile={profile}
          hasUnreadMessages={hasUnreadMessages}
          showSidebarAds={systemConfig.adsConfig?.sidebar ?? true}
        />
      </div>
      <main className="flex-1 md:ml-60 px-4 pt-[calc(max(env(safe-area-inset-top),16px))] pb-32 md:py-6 sm:px-6 md:px-6 min-w-0">
        <div className="max-w-7xl mx-auto w-full">
          {pendingSyncs > 0 && (
            <div className="mb-4 bg-yellow-500 p-3 rounded-xl shadow-lg shadow-yellow-500/20 flex items-center gap-3 animate-in slide-in-from-top duration-500 relative group">
              <Loader2 size={18} className="text-white animate-spin" />
              <p className="text-xs font-black text-white uppercase tracking-wider flex-1">
                {pendingSyncs} poze așteaptă sincronizarea (mod offline).
              </p>
            </div>
          )}
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
          {profile.accountType === 'PF' && (systemConfig.adsConfig?.main ?? true) && <AdBanner />}
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
      {!(profile?.accountType === 'PF' && currentPage === Page.Clients) && (
        <div 
          className="md:hidden fixed left-0 right-0 z-50 pointer-events-none transform-gpu will-change-transform"
          style={{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          <MobileDock 
            activePage={currentPage} 
            onNavigate={navigateTo} 
            activeVisit={activeVisit} 
            onStopWork={handleOpenGlobalStop} 
            isAdmin={profile.role === 'admin'} 
            profile={profile} 
            subscriptionTier={subscriptionTier}
          />
        </div>
      )}

      {isFinishModalOpen && activeVisit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsFinishModalOpen(false)}></div>
          <div className="stihl-card w-full max-w-lg rounded-lg p-5 sm:p-6 relative animate-in zoom-in duration-300 bg-bg-card max-h-[95vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-black text-main">{t('Finish Report')}</h3>
              <div className="flex items-center gap-2">
                {isProcessing && <Loader2 size={18} className="animate-spin text-accent-color" />}
                <label className="p-1.5 rounded-xl bg-accent-color/10 text-accent-color hover:bg-accent-color/20 cursor-pointer transition-all border border-accent-color/20 shadow-sm" title={t('Add Photo')}>
                  <Camera size={18} />
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                    onChange={(e) => handleFileUpload(e, activeVisit)} 
                  />
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
              {activeVisit.photos && activeVisit.photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {activeVisit.photos.map((url, idx) => (
                    <div key={idx} className="relative w-14 h-14 flex-shrink-0 group">
                      <img 
                        src={url} 
                        className="w-full h-full object-cover rounded-lg border border-border-color cursor-pointer" 
                        alt="Visit" 
                        onClick={() => setPhotoViewer(url)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Notebook size={12} className="text-accent-color" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">{t('Work Notes')}</span>
                </div>
                <textarea 
                  className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-medium outline-none focus:border-accent-color min-h-[60px] resize-none"
                  placeholder={t('Work details or observations...')}
                  value={finishNote}
                  onChange={(e) => setFinishNote(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-text-secondary mb-1">
                  <List size={12} className="text-accent-color" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">{t('Performed Services')}</span>
                </div>
                <div className="space-y-2">
                  {serviceTypes.filter(st => st.isActive !== false).map(st => {
                    const startTime = activeVisit.currentSessionStart?.toDate() || new Date();
                    const durationHours = ((new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(2);

                    return (
    
                      <div key={st.id} className="flex items-center gap-3 p-2.5 rounded-md bg-bg-main border border-border-color">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 accent-accent-color" 
                          checked={selectedServices[st.id]?.selected || false} 
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            let quantity = selectedServices[st.id]?.quantity || '';
                            
                            if (isChecked && !quantity) {
                              const unit = (st.unit || '').toLowerCase();
                              if (unit === 'm²' || unit === 'mp' || unit === 'm2') {
                                quantity = currentClientSuprafata.toString();
                              } else if (unit === 'ora' || unit === 'ore' || unit === 'h') {
                                quantity = durationHours;
                              }
                            }
                            
                            setSelectedServices({
                              ...selectedServices, 
                              [st.id]: { ...selectedServices[st.id], selected: isChecked, quantity }
                            });
                          }} 
                        />
                        <p className="flex-1 text-[11px] font-bold uppercase text-main leading-tight">{st.name}</p>
                        {selectedServices[st.id]?.selected && (
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number" 
                              className="w-16 bg-bg-card border border-border-color px-1.5 py-1 rounded-sm text-[11px] font-bold" 
                              value={selectedServices[st.id]?.quantity || ''} 
                              onChange={(e) => setSelectedServices({...selectedServices, [st.id]: {...selectedServices[st.id], quantity: e.target.value}})} 
                            />
                            <span className="text-[8px] font-black text-text-secondary uppercase">{st.unit}</span>
                          </div>
                        )}
                      </div>
                      
  );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center pt-4 mt-4 border-t border-border-color flex-shrink-0 w-full">
              <div className="flex gap-4 w-full">
                <button onClick={handleGlobalFinalize} disabled={isProcessing} className="flex-1 stihl-button py-3 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md flex items-center justify-center gap-2">
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {t('Save Report')}
                </button>
                <button onClick={() => setIsFinishModalOpen(false)} className="px-6 bg-bg-main border border-border-color rounded-md font-bold uppercase tracking-wider text-xs text-text-secondary hover:bg-black/5 dark:hover:bg-white/5">{t('Close')}</button>
              </div>

              <button 
                onClick={() => {
                  const num1 = Math.floor(Math.random() * 10) + 1;
                  const num2 = Math.floor(Math.random() * 10) + 1;
                  setMathProblem({num1, num2, answer: ''});
                  setConfirmationModal({
                    title: "Anulare Sesiune Activă",
                    message: "Ești sigur că vrei să anulezi cronometrul? Această lucrare va reveni la starea de Programat și raportul nu va fi salvat.",
                    requireMath: true,
                    onConfirm: async () => {
                      try {
                        setIsProcessing(true);
                        if (activeVisit.autoScheduledNextVisitId) {
                          try {
                            await deleteDoc(doc(db, 'visits', activeVisit.autoScheduledNextVisitId));
                          } catch (err) {
                            console.error("Failed to delete auto-scheduled visit:", err);
                          }
                        }
                        await updateDoc(doc(db, 'visits', activeVisit.id), {
                          status: 'Programat',
                          currentSessionStart: null,
                          nextVisitScheduled: false,
                          autoScheduledNextVisitId: null
                        });
                        setIsFinishModalOpen(false);
                        logger.log("Sesiunea a fost anulată cu succes", "success");
                      } catch (e: any) { alert(e.message); }
                      finally {
                        setIsProcessing(false);
                      }
                    }
                  });
                }}
                disabled={isProcessing}
                className="mt-3 text-[11px] text-text-secondary/60 hover:text-red-500 font-medium underline flex-shrink-0 text-center transition-colors pb-1 cursor-pointer"
              >
                Ai pornit din greșeală? Anulează pornirea
              </button>
            </div>
          </div>
        </div>
      )}

      {photoViewer && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-in fade-in" onClick={() => setPhotoViewer(null)}>
            <img src={photoViewer} className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain" alt={t('Photo View')} onClick={(e) => e.stopPropagation()} />
            <button onClick={() => setPhotoViewer(null)} className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors">
              <X size={24} />
            </button>
        </div>
      )}

      {confirmationModal && (
        <div className="fixed inset-0 z-[2020] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setConfirmationModal(null)}></div>
          <div className="stihl-card w-full max-w-md rounded-lg p-8 relative bg-bg-card animate-in zoom-in-95 duration-300 border border-border-color shadow-2xl">
            <h3 className="text-xl font-black mb-4 text-main">{confirmationModal.title}</h3>
            <p className="text-sm text-text-secondary mb-6">{confirmationModal.message}</p>
            
            {confirmationModal.requireMath && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg">
                 <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-2">Pentru a confirma acțiunea, rezolvați calculul:</p>
                 <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-main">{mathProblem.num1} + {mathProblem.num2} = </span>
                    <input 
                      type="number" 
                      className="w-20 bg-bg-main border border-border-color rounded-md px-3 py-2 text-lg font-bold text-main outline-none focus:border-red-500"
                      value={mathProblem.answer}
                      onChange={(e) => setMathProblem(p => ({...p, answer: e.target.value}))}
                    />
                 </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmationModal(null)} className="px-6 py-2.5 bg-bg-main border border-border-color rounded-md font-bold uppercase tracking-wider text-xs text-text-secondary hover:bg-border-color cursor-pointer">{t('Cancel')}</button>
              <button 
                onClick={async () => {
                  if (confirmationModal.onConfirm) await confirmationModal.onConfirm();
                  setConfirmationModal(null);
                }} 
                disabled={confirmationModal.requireMath ? parseInt(mathProblem.answer) !== (mathProblem.num1 + mathProblem.num2) : false}
                className={`px-6 py-2.5 text-white rounded-md font-bold uppercase tracking-wider text-xs shadow-md transition-all cursor-pointer ${
                  (confirmationModal.requireMath && parseInt(mathProblem.answer) !== (mathProblem.num1 + mathProblem.num2))
                    ? 'bg-text-secondary opacity-50 cursor-not-allowed'
                    : 'bg-accent-color hover:bg-accent-color/90'
                }`}
              >
                Confirmă
              </button>
            </div>
          </div>
        </div>
      )}

      <VersionChecker />
      <Toaster position="bottom-right" />
    </div>
      </>
    </DataProvider>
    
  );
};

export default App;