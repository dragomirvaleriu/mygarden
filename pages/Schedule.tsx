import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { checkFutureVisitExists } from '../services/visitUtils';
import { useData } from '../src/context/DataContext';

import { SmartDateInput } from '../components/SmartDateInput';
import { toast } from 'react-hot-toast';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  Timestamp,
  where,
  getDocs,
  getDoc,
  writeBatch,
  deleteDoc,
  auth,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
  handleFirestoreError,
  OperationType
} from '../services/firebase';
import RoutePlanner from './RoutePlanner';
import WeeklyKanban from '../components/WeeklyKanban';
import { Visit, Client, Page, ServiceType, WorkSession, UserProfile, Property, PotentialClient } from '../src/types';
import { Carousel } from 'react-responsive-carousel';
import 'react-responsive-carousel/lib/styles/carousel.min.css';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addWeeks, subWeeks, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays, getMonth, setMonth } from 'date-fns';
import { monthlyGuide } from '../src/data/monthlyGuide';
import { ro } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { MapPin, Phone, MessageCircle, Play, Square, Info, Image as ImageIcon, Upload, Loader2, X, Edit2, Trash2, Calendar as CalendarIcon, List, Building2, User, Clock, CheckCircle2, Maximize2, Hash, Plus, ChevronLeft, ChevronRight, Map, UserCheck, CalendarPlus, FastForward, CalendarClock, Camera, Notebook, NotebookText, UserPlus, Droplets, DollarSign, LayoutDashboard, Sprout, Zap, History, XCircle } from 'lucide-react';
import { logger } from '../services/logger';
import { compressImage } from '../utils/image';
import { getMapsUrl } from '../utils/maps';
import { isIrrigatingToday } from '../utils/irrigation';
import { calculateTotalDuration } from '../utils/time';
import { usePlan } from '../src/hooks/usePlan';


import { SchedulePageSkeleton } from '../components/PageSkeletons';
import EditLeadModal from '../components/EditLeadModal';
import NewLeadModal from '../components/NewLeadModal';
import { AgendaView } from '../components/schedule/AgendaView';
import { EmptyState } from '../components/EmptyState';

// Extracted Modals
import { EditVisitModal } from '../components/schedule/EditVisitModal';
import { NoteModal } from '../components/schedule/NoteModal';
import { FinishVisitModal } from '../components/schedule/FinishVisitModal';

// Extracted Views
import { GuideView } from '../components/schedule/views/GuideView';
import { ListView } from '../components/schedule/views/ListView';
import { DailyAgendaView } from '../components/schedule/views/DailyAgendaView';
import { AdBanner } from '../src/components/AdBanner';
import { ClientHistoryModal } from '../components/ClientHistoryModal';
import { ClientInfoModal } from '../components/clients/ClientInfoModal';

interface Props {
  onNavigate: (page: Page, id?: string) => void;
  organizationId: string;
  userRole: string;
  userProfile?: UserProfile;
}

const formatVisitDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
};

import { enUS } from 'date-fns/locale';
import { pl } from 'date-fns/locale/pl';
import { cs } from 'date-fns/locale/cs';
import { hu } from 'date-fns/locale/hu';
import { de } from 'date-fns/locale/de';
import { nl } from 'date-fns/locale/nl';
import { fr } from 'date-fns/locale/fr';
import { es } from 'date-fns/locale/es';
import { formatLongDate, parseSafeDate, calculateDaysSinceLastVisit, calculateDaysSinceVisitCompleted } from '../utils/date';

const locales = {
  ro,
  en: enUS,
  pl,
  cs,
  hu,
  de,
  nl,
  fr,
  es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

/**
 * Returns the nearest working day ON OR AFTER `date`.
 * Identical implementation to reschedule.ts — single source of truth.
 * For "reschedule to tomorrow" semantics, pass addDays(date, 1) as the argument.
 */
const getNextWorkingDay = (date: Date, workDays: string): Date => {
  let target = new Date(date);
  while (true) {
    const dayOfWeek = getDay(target);
    let isWorkDay = true;
    if (workDays === 'L-V' && (dayOfWeek === 0 || dayOfWeek === 6)) isWorkDay = false;
    if (workDays === 'L-S' && dayOfWeek === 0) isWorkDay = false;
    if (isWorkDay) return target;
    target = addDays(target, 1);
  }
};

const getPreviousWorkingDay = (date: Date, workDays: string): Date => {
  let prevDate = addDays(date, -1);
  while (true) {
    const dayOfWeek = getDay(prevDate); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (workDays === 'L-V' && (dayOfWeek === 0 || dayOfWeek === 6)) {
      prevDate = addDays(prevDate, -1);
      continue;
    }
    if (workDays === 'L-S' && dayOfWeek === 0) {
      prevDate = addDays(prevDate, -1);
      continue;
    }
    break;
  }
  return prevDate;
};

const normalizeAddress = (addr?: string): string => {
  if (!addr) return '';
  return addr.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const Schedule: React.FC<Props> = ({ onNavigate, organizationId, userRole, userProfile }) => {
  const { t, i18n } = useTranslation();
  const { features, subscriptionTier } = usePlan();

  const currentLocale = (locales as any)[i18n.language] || ro;
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { visits, clients, properties, serviceTypes, organization, employees, leads, loading } = useData();

  const accountType = userProfile?.accountType || 'PJ';
  const isPF = accountType === 'PF';
  const [viewMode, setViewMode] = useState<'list' | 'agenda' | 'kanban' | 'route' | 'guide'>('list');
  const [activeViewsDesktop, setActiveViewsDesktop] = useState<string[]>(['list', 'agenda', 'kanban', 'route']);
  const [activeViewsMobile, setActiveViewsMobile] = useState<string[]>(['list', 'agenda', 'kanban', 'route']);

  // Handle mobile detection and persistent view mode initialization
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (userProfile) {
      const savedMode = isMobile ? userProfile.mobile_viewMode : userProfile.desktop_viewMode;
      const allowedViews = isMobile ? activeViewsMobile : activeViewsDesktop;
      
      setViewMode(currentViewMode => {
        if (savedMode && allowedViews.includes(savedMode)) {
          return savedMode as any;
        } else if (allowedViews.length > 0 && !allowedViews.includes(currentViewMode)) {
          return allowedViews[0] as any;
        }
        return currentViewMode;
      });
    }
  }, [userProfile, isMobile, activeViewsDesktop, activeViewsMobile]);

  useEffect(() => {
    if (window.innerWidth < 768 && !loading) {
      const element = document.getElementById('schedule-content-anchor');
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, viewMode]);
  const [selectedGuideMonth, setSelectedGuideMonth] = useState(getMonth(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);

  const currentWeekStart = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return addWeeks(start, weekOffset);
  }, [weekOffset]);

  const handleViewModeChange = useCallback(async (mode: 'list' | 'agenda' | 'kanban' | 'route' | 'guide') => {
    if (mode === 'kanban' && !features.hasKanban) {
      logger.log(t('This feature is only available for Pro users.'), 'info');
      return;
    }
    if (mode === 'route' && !features.hasRoutePlanner) {
      logger.log(t('This feature is only available for Pro users.'), 'info');
      return;
    }
    setViewMode(mode);
    
    // Persist to Firestore
    if (auth.currentUser) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          [isMobile ? 'mobile_viewMode' : 'desktop_viewMode']: mode
        });
      } catch (err) {
        console.error("Error saving view mode preference:", err);
      }
    }
  }, [features.hasKanban, features.hasRoutePlanner, t, isMobile]);

  const handlePrevWeek = useCallback(() => setWeekOffset(prev => prev - 1), []);
  const handleNextWeek = useCallback(() => setWeekOffset(prev => prev + 1), []);
  const handleCurrentWeek = useCallback(() => setWeekOffset(0), []);

  const filteredVisits = useMemo(() => {
    return visits.filter(v => v.status !== 'Finalizat');
  }, [visits]);
  

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState<{visit: Visit, type: 'view' | 'add'} | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [clientInfoModalData, setClientInfoModalData] = useState<{ client: Client, type: 'fertilizer' | 'visits' | 'financial' | 'properties', propertyId?: string } | null>(null);
  const [nextScheduledDateStr, setNextScheduledDateStr] = useState<string | null>(null);
  const [autoRescheduleOverride, setAutoRescheduleOverride] = useState<boolean | null>(null);
  const [selectedServices, setSelectedServices] = useState<Record<string, {selected: boolean, quantity: string}>>({});
  const [finishNote, setFinishNote] = useState('');
  const [interventieCost, setInterventieCost] = useState('');
  const [interventieIncasata, setInterventieIncasata] = useState(false);
  const [editVisitDate, setEditVisitDate] = useState<string>('');
  const [editVisitStartTime, setEditVisitStartTime] = useState<string>('');
  const [editVisitEndTime, setEditVisitEndTime] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [pendingStartVisitId, setPendingStartVisitId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [confirmationModal, setConfirmationModal] = useState<{ title: string; message: string; onConfirm: () => void | Promise<void>; requireMath?: boolean; } | null>(null);
  const [mathProblem, setMathProblem] = useState({num1: 0, num2: 0, answer: ''});
  const [photoViewer, setPhotoViewer] = useState<string | null>(null);
  const [defaultFertilizerDosage, setDefaultFertilizerDosage] = useState<number>(25);
  const [workDays, setWorkDays] = useState<'L-V' | 'L-S' | 'L-D'>('L-S');
  const [sortByDistance, setSortByDistance] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);


  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showEditLeadModal, setShowEditLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PotentialClient | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<{clientId: string, clientName: string, propertyId?: string, propertyName?: string} | null>(null);

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'ofertat') {
        updateData.ofertatAt = serverTimestamp();
      }
      await updateDoc(doc(db, 'leads', leadId), updateData);
      logger.log(`Status lead actualizat: ${newStatus}`, "info");
    } catch (err) {
      console.error("Error updating lead status:", err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFinishModal) {
        setShowFinishModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFinishModal]);

  const handleConvertToClient = (lead: PotentialClient) => {
    onNavigate(Page.ClientForm, `lead:${lead.id}`);
  };
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // Unified organization settings listener (single subscription)
  useEffect(() => {
    if (!organizationId) return;
    const unsubOrg = onSnapshot(doc(db, 'organizations', organizationId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.workDays) setWorkDays(data.workDays);
        if (data.startTime) setStartTime(data.startTime);
        if (data.endTime) setEndTime(data.endTime);
        if (data.defaultFertilizerDosage) setDefaultFertilizerDosage(data.defaultFertilizerDosage);
        if (data.activeViewsDesktop) setActiveViewsDesktop(data.activeViewsDesktop);
        if (data.activeViewsMobile) setActiveViewsMobile(data.activeViewsMobile);
      }
    }, (err) => {
      console.error('Organization settings listener error:', err);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, `organizations/${organizationId}`);
      }
    });
    return () => unsubOrg();
  }, [organizationId]);
  
  // Agenda View Optimized Sorting
  const lastVisitDates = useMemo(() => {
    const map: Record<string, string> = {};
    visits.filter(v => v.status === 'Finalizat' && v.data).forEach(v => {
      if (!map[v.clientId] || v.data > map[v.clientId]) {
        map[v.clientId] = v.data;
      }
    });
    return map;
  }, [visits]);

  const agendaVisits = useMemo(() => {
    // Show non-finalized visits from last 7 days + future (handles overdue visits like URBAN EXPANSION)
    const sevenDaysAgo = addDays(new Date(), -7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    return visits
      .filter(v => v.status !== 'Finalizat')
      // admin vede tot, nu doar propriile vizite
      .filter(v => userRole === 'admin' || (v as any).isLead || v.assignedTo === auth.currentUser?.uid)
      .filter(v => {
         const d = v.data || '';
         if (!d) return false;
         // Use parseSafeDate to handle both "2026-06-30" and "30.06.2026" formats
         try {
           const visitDate = parseSafeDate(d);
           if (isNaN(visitDate.getTime())) return false;
           return visitDate >= sevenDaysAgo;
         } catch {
           return false;
         }
      })
      .sort((a, b) => {
        // Sort by parsed date (not raw string) for correct ordering
        const aDate = a.data ? parseSafeDate(a.data).getTime() : 0;
        const bDate = b.data ? parseSafeDate(b.data).getTime() : 0;
        const dComp = aDate - bDate;
        if (dComp !== 0) return dComp;

        const aLast = lastVisitDates[a.clientId];
        const bLast = lastVisitDates[b.clientId];
        
        if (aLast && bLast) {
          return aLast.localeCompare(bLast);
        }
        if (aLast) return -1;
        if (bLast) return 1;
        return (a.clientName || '').localeCompare(b.clientName || '');
      });
  }, [visits, userRole, auth.currentUser?.uid, lastVisitDates]);

  const [listFilter, setListFilter] = useState<'all' | 'azi' | 'viitor' | 'arhiva'>('all');
  const [archivePage, setArchivePage] = useState(1);
  const ARCHIVE_PER_PAGE = useMemo(() => {
    if (windowWidth < 768) return 4;   // 1 col * 4 rows
    if (windowWidth < 1280) return 8;  // 2 cols * 4 rows
    if (windowWidth < 1536) return 12; // 3 cols * 4 rows
    return 16;                         // 4 cols * 4 rows
  }, [windowWidth]);
  
  const historyFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedHistoryVisitId, setSelectedHistoryVisitId] = useState<string | null>(null);

  const handleArchivePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedHistoryVisitId) return;

    await handleVisitPhotoUpload(selectedHistoryVisitId, file);
    
    if (historyFileInputRef.current) historyFileInputRef.current.value = '';
    setSelectedHistoryVisitId(null);
  };

  const handleDeletePhoto = async (visitId: string, photoUrl: string) => {
    setConfirmationModal({
      title: t('Delete Photo'),
      message: t('Are you sure you want to delete this photo? This action is irreversible!'),
      onConfirm: async () => {
        try {
            const visitRef = doc(db, 'visits', visitId);
            const visitSnap = await getDoc(visitRef);
            if (visitSnap.exists()) {
                const visitData = visitSnap.data() as Visit;
                const updatedPhotos = visitData.photos?.filter(p => p !== photoUrl) || [];
                await updateDoc(visitRef, { photos: updatedPhotos });
                
                // Also delete from client_history if it exists there
                const historyQ = query(collection(db, 'client_history'), where('visitId', '==', visitId), where('organizationId', '==', organizationId));
                const historySnap = await getDocs(historyQ);
                if (!historySnap.empty) {
                    const historyDoc = historySnap.docs[0];
                    const historyData = historyDoc.data();
                    const updatedHistoryPhotos = historyData.photos?.filter((p: any) => (typeof p === 'string' ? p : p.url) !== photoUrl) || [];
                    await updateDoc(historyDoc.ref, { photos: updatedHistoryPhotos });
                }
                
                logger.log(t('Photo deleted successfully'), "warn");
                
                // Reset current photo index if needed
                setCurrentPhotoIndex(prev => {
                    const newIndex = Math.max(0, (prev[visitId] || 0) - 1);
                    return { ...prev, [visitId]: newIndex };
                });
            }
        } catch (err: any) {
            console.error("Error deleting photo:", err);
            logger.log(t('Delete Error') + ": " + err.message, "error");
        }
      }
    });
  };

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleSortByDistance = () => {
    if (sortByDistance) {
      setSortByDistance(false);
      return;
    }

    if (!navigator.geolocation) {
      alert(t('Geolocation is not supported by your browser.'));
      return;
    }

    setIsProcessing(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setSortByDistance(true);
        setIsProcessing(false);
        logger.log(t('Location detected. Schedule has been optimized.'), "success");
      },
      (error) => {
        console.error("Error getting location:", error);
        alert(t('Could not detect location. Check permissions.'));
        setIsProcessing(false);
      }
    );
  };

  const [formData, setFormData] = useState<Partial<Visit>>({
    clientId: '',
    tipLucrare: serviceTypes.find(st => st.isDefault)?.name || serviceTypes[0]?.name || t('Maintenance'),
    status: 'Programat',
    data: format(new Date(), 'yyyy-MM-dd'),
    oraProgramare: 'OFF',
    oraInceput: '',
    oraSfarsit: '',
    detalii: '',
    assignedTo: auth.currentUser?.uid || '',
    propertyId: '',
    propertyAddress: '',
    propertyMapsLink: ''
  });

  const formatDuration = (minutes: number) => {
    if (!minutes) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const handleVisitPhotoUpload = async (visitId: string, file: File) => {
    setUploadingId(visitId);
    try {
      // 1. Compress Image
      const compressedBlob = await compressImage(file);

      // 2. Upload File
      const storageRef = ref(storage, `uploads/${organizationId}/${auth.currentUser?.uid}/visits/${visitId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, compressedBlob);
      const url = await getDownloadURL(storageRef);
      
      const timestamp = new Date().toISOString();

      // 3. Update Visit (photos array of strings)
      const visitRef = doc(db, 'visits', visitId);
      const visitSnap = await getDoc(visitRef);
      
      if (visitSnap.exists()) {
        const visitData = visitSnap.data() as Visit;
        const newPhotos = [...(visitData.photos || []), url];
        await updateDoc(visitRef, { photos: newPhotos });
        
        // 3. Sync with Client History (photos array of objects {url, date})
        const historyQuery = query(
          collection(db, 'client_history'), 
          where('visitId', '==', visitId),
          where('organizationId', '==', organizationId)
        );
        const historySnap = await getDocs(historyQuery);
        
        if (!historySnap.empty) {
          const historyDoc = historySnap.docs[0];
          const historyData = historyDoc.data();
          const currentHistoryPhotos = historyData.photos || [];
          
          await updateDoc(historyDoc.ref, {
            photos: [...currentHistoryPhotos, { url, date: timestamp }]
          });
          logger.log(t('Sync Success', { count: 1 }), "info");
        }

        logger.log(t('Photo added to work'), "success");
      }
    } catch (err: any) {
      console.error("Photo upload error:", err);
      alert(t('Error uploading photo') + ": " + err.message);
    } finally {
      setUploadingId(null);
    }
  };

  // Generate time slots based on organization settings
  const allPossibleSlots = useMemo(() => {
    const slots = [];
    const startH = parseInt(startTime.split(':')[0]);
    const endH = parseInt(endTime.split(':')[0]);
    
    for (let h = startH; h <= endH; h++) {
      const hourStr = h.toString().padStart(2, '0');
      slots.push(`${hourStr}:00`);
      if (h < endH) {
        slots.push(`${hourStr}:30`);
      }
    }
    return slots;
  }, [startTime, endTime]);

  // Effect to calculate available slots when date or client changes
  useEffect(() => {
    if (!formData.data) {
      setAvailableSlots([]);
      return;
    }

    const scheduledOnDay = visits
      .filter(v => v.data === formData.data && v.status !== 'Finalizat' && v.id !== editingVisitId)
      // Bug #7 fix: map oraProgramare (ora efectivă), nu v.data (data calendaristică)
      .map(v => v.oraProgramare)
      .filter(Boolean) as string[];

    // Create a set of blocked slots, including the 30-min buffer after each appointment
    const blockedSlots = new Set<string>();
    scheduledOnDay.forEach(slot => {
      blockedSlots.add(slot);
      // Add the next 30-minute slot as blocked for travel
      const [hour, minute] = slot.split(':').map(Number);
      if (minute === 0) {
        blockedSlots.add(`${hour.toString().padStart(2, '0')}:30`);
      } else { // minute is 30
        const nextHour = hour + 1;
        if (nextHour < 17) { // Ensure we don't block past the end of the day
          blockedSlots.add(`${nextHour.toString().padStart(2, '0')}:00`);
        }
      }
    });

    const slots = ['OFF', ...allPossibleSlots.filter(slot => {
      if (slot === 'OFF') return true;
      const [h, m] = slot.split(':').map(Number);
      const time = h * 60 + m;
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const start = startH * 60 + startM;
      const end = endH * 60 + endM;
      return time >= start && time <= end && !blockedSlots.has(slot);
    })];
    
    setAvailableSlots(slots);

    // Auto-select first available slot if current selection is not available
    if (!formData.data) {
      setFormData(prev => ({ ...prev, data: format(new Date(), 'yyyy-MM-dd') }));
    }

  }, [formData.data, visits, allPossibleSlots, editingVisitId]);

  // Bug #5 fix: al doilea useEffect duplicat pentru organizations a fost eliminat.
  // Primul useEffect (linia ~304) deja citeste workDays, defaultFertilizerDosage, activeViews.



  const executeSyncData = async () => {
    setIsMigrating(true);
    try {
      const batch = writeBatch(db);
      let updateCount = 0;

      // 1. Fix Orphaned Visits (Missing OrganizationId)
      const qVisits = query(collection(db, 'visits'), where('organizationId', '==', organizationId));
      const visitsSnap = await getDocs(qVisits);
      
      visitsSnap.forEach(d => {
        if (!d.data().organizationId) {
          batch.update(d.ref, { organizationId });
          updateCount++;
        }
      });

      // 2. Sync Photos from History to Visits
      const qHistory = query(collection(db, 'client_history'), where('organizationId', '==', organizationId));
      const historySnap = await getDocs(qHistory);
      
      // Map history photos by visitId
      const historyPhotosMap: Record<string, string[]> = {};
      historySnap.forEach(doc => {
        const data = doc.data();
        if (data.visitId && data.photos && Array.isArray(data.photos)) {
          const urls = data.photos.map((p: any) => {
            if (typeof p === 'string') return p;
            return p?.url;
          }).filter(Boolean);
          
          if (urls.length > 0) {
            if (!historyPhotosMap[data.visitId]) {
              historyPhotosMap[data.visitId] = [];
            }
            historyPhotosMap[data.visitId] = [...new Set([...historyPhotosMap[data.visitId], ...urls])];
          }
        }
      });

      // Update visits with missing photos
      visitsSnap.forEach(doc => {
        const visit = doc.data() as Visit;
        const historyPhotos = historyPhotosMap[doc.id];
        
        if (historyPhotos) {
          const currentPhotos = visit.photos || [];
          const newPhotos = [...new Set([...currentPhotos, ...historyPhotos])];
          
          if (newPhotos.length > currentPhotos.length) {
            batch.update(doc.ref, { photos: newPhotos });
            updateCount++;
          }
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        logger.log(t('Synchronization successful: {{count}} updates.', { count: updateCount }), "success");
      } else {
        alert(t('Data is already synchronized.'));
      }
    } catch (e: any) { 
      console.error(e);
      alert(t('Sync Error') + ": " + e.message); 
    } finally { 
      setIsMigrating(false); 
    }
  };

  const handleSyncData = () => {
    setConfirmationModal({
      title: t('Confirm Data Synchronization'),
      message: t('This action will scan and update all missions, photos, and history entries to ensure data consistency. Are you sure you want to continue?'),
      onConfirm: executeSyncData
    });
  };

  const handleStartWork = async (visit: Visit) => {
    const active = visits.find(v => v.status === 'Activ');
    if (active) {
      setPendingStartVisitId(visit.id);
      handleOpenFinish(active);
      return;
    }

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'visits', visit.id), { 
        status: 'Activ', 
        currentSessionStart: serverTimestamp(),
        assignedTo: visit.assignedTo || auth.currentUser?.uid || ''
      });

      // AUTO-SCHEDULE NEXT VISIT ON START
      if (!visit.nextVisitScheduled) {
        const client = clients.find(c => c.id === visit.clientId);
        // Property-level config takes priority for multi-address clients
        const prop = properties.find(p => p.id === visit.propertyId);
        const contractType = prop?.contractType || client?.contractType;
        const freq = prop?.maintenanceFrequency || client?.maintenanceFrequency || 'weekly';
        if (client && contractType === 'maintenance' && freq !== 'occasional') {
            let daysToAdd = 0;
            if (freq === 'weekly') daysToAdd = 7;
            else if (freq === 'biweekly') daysToAdd = 14;
            else if (freq === 'monthly') daysToAdd = 28;

            if (daysToAdd > 0) {
                let nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + daysToAdd);
                nextDate.setHours(0, 0, 0, 0);
                // getNextWorkingDay returns date itself if already a working day
                nextDate = getNextWorkingDay(nextDate, workDays);

                const hasFuture = await checkFutureVisitExists(client.id, visit.propertyId || null);
                if (!hasFuture) {
                const nextVisitRef = await addDoc(collection(db, 'visits'), {
                    clientId: client.id,
                    clientName: client.nume || 'Client',
                    clientAddress: visit.propertyAddress || client.adresa || '',
                    organizationId,
                    status: 'Programat',
                    data: format(nextDate, 'yyyy-MM-dd'),
                    originalData: format(nextDate, 'yyyy-MM-dd'), // immutable creation date
                    oraProgramare: 'OFF',
                    tipLucrare: visit.tipLucrare || 'Mentenanță',
                    createdAt: serverTimestamp(),
                    propertyId: visit.propertyId || null,
                    propertyAddress: visit.propertyAddress || '',
                    propertyMapsLink: visit.propertyMapsLink || '',
                    assignedTo: visit.assignedTo || auth.currentUser?.uid,
                    assignedToName: visit.assignedToName || auth.currentUser?.displayName || auth.currentUser?.email
                });

                await updateDoc(doc(db, 'visits', visit.id), {
                  nextVisitScheduled: true,
                  autoScheduledNextVisitId: nextVisitRef.id
                });
                logger.log(t('Auto schedule created for {{date}}', { date: format(nextDate, 'd MMMM', { locale: currentLocale }) }), "success");
                }
            }
        }
      }
    } catch (err: any) { alert(err.message); }
    finally { setIsProcessing(false); }
  };

  const isWithinOperationalHours = (date: Date): boolean => {
    const dayOfWeek = getDay(date); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (workDays === 'L-V' && (dayOfWeek === 0 || dayOfWeek === 6)) return false;
    if (workDays === 'L-S' && dayOfWeek === 0) return false;
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const time = date.getHours() * 60 + date.getMinutes();
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    
    return time >= start && time <= end;
  };

  const handleRescheduleToTomorrow = async (visit: Visit) => {
    let today = new Date();
    if (visit.data && visit.data !== 'Fără dată') {
        try {
            const parsed = parseSafeDate(visit.data);
            if (!isNaN(parsed.getTime())) today = parsed;
        } catch {}
    }
    // Pre-advance by 1 day so getNextWorkingDay finds the NEXT working day, not today itself
    const tomorrow = getNextWorkingDay(addDays(today, 1), workDays);
    
    const [startH, startM] = startTime.split(':').map(Number);
    tomorrow.setHours(startH, startM, 0, 0);
    
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

    setConfirmationModal({
      title: t('Reschedule'),
      message: t('Are you sure you want to reschedule this task for {{date}}?', { date: format(tomorrow, 'd MMMM', { locale: currentLocale }) }),
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const isLead = (visit as any).isLead;
          const realId = isLead ? visit.id.replace('lead_', '') : visit.id;
          const docRef = doc(db, isLead ? 'leads' : 'visits', realId);
          
          const updatePayload: any = { data: tomorrowStr };

          if (isLead) {
            updatePayload.nextActionDate = tomorrowStr;
          } else {
            // Preserve originalData — set it only if not already set (backward compat for old visits)
            updatePayload.originalData = (visit as any).originalData || visit.data;
          }
          
          await updateDoc(docRef, updatePayload);
          logger.log(t('Task rescheduled for {{date}}', { date: format(tomorrow, 'd MMMM', { locale: currentLocale }) }), "info");
        } catch (err: any) {
          logger.log(t('Reschedule error: {{message}}', { message: err.message }), "error");
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };


  const handleRescheduleToYesterday = async (visit: Visit) => {
    let today = new Date();
    if (visit.data && visit.data !== 'Fără dată') {
        try {
            const parsed = parseSafeDate(visit.data);
            if (!isNaN(parsed.getTime())) today = parsed;
        } catch {}
    }
    const yesterday = getPreviousWorkingDay(today, workDays);
    
    const [startH, startM] = startTime.split(':').map(Number);
    yesterday.setHours(startH, startM, 0, 0);
    
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    setConfirmationModal({
      title: t('Reschedule'),
      message: t('Are you sure you want to reschedule this task for {{date}}?', { date: format(yesterday, 'd MMMM', { locale: currentLocale }) }),
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const isLead = (visit as any).isLead;
          const realId = isLead ? visit.id.replace('lead_', '') : visit.id;
          const docRef = doc(db, isLead ? 'leads' : 'visits', realId);
          
          const updatePayload: any = { data: yesterdayStr };

          if (isLead) {
            updatePayload.nextActionDate = yesterdayStr;
          } else {
            // Preserve originalData — set it only if not already set (backward compat for old visits)
            updatePayload.originalData = (visit as any).originalData || visit.data;
          }
          
          await updateDoc(docRef, updatePayload);
          logger.log(t('Task rescheduled for {{date}}', { date: format(yesterday, 'd MMMM', { locale: currentLocale }) }), "info");
        } catch (err: any) {
          logger.log(t('Reschedule error: {{message}}', { message: err.message }), "error");
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };


  const handleMoveAllToTomorrow = async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const currentWeekEndStr = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const visitsToMove = visits.filter(v => {
      const isUnfinished = v.status !== 'Finalizat';
      const isLeadValid = (!(v as any).isLead || (v as any).leadData?.status === 'vizualizat');
      // Use parseSafeDate for robust date comparison
      try {
        const vDate = format(parseSafeDate(v.data || ''), 'yyyy-MM-dd');
        const isThisWeek = vDate >= todayStr && vDate <= currentWeekEndStr;
        return isUnfinished && isLeadValid && isThisWeek;
      } catch { return false; }
    });

    if (visitsToMove.length === 0) return;

    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setMathProblem({ num1, num2, answer: '' });

    setConfirmationModal({
      title: t("Amânare Zi Ploaie / Delay All"),
      message: t('Sunt {{count}} programări rămase în această săptămână. Ești sigur că vrei să le amâni pe absolut toate cu 1 zi în avans?', { count: visitsToMove.length }),
      requireMath: true,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const batch = writeBatch(db);
          visitsToMove.forEach(v => {
            const isLead = (v as any).isLead;
            const realId = isLead ? v.id.replace('lead_', '') : v.id;
            const docRef = doc(db, isLead ? 'leads' : 'visits', realId);
            
            // Use parseSafeDate for robust parsing of both ISO and DD.MM.YYYY formats
            let currentDate: Date;
            try {
              currentDate = parseSafeDate(v.data || todayStr);
            } catch {
              currentDate = new Date();
            }

            // Advance by 1 first so we always move to the NEXT working day, not today itself
            const nextDateObj = getNextWorkingDay(addDays(currentDate, 1), workDays);
            const nextDateStr = format(nextDateObj, 'yyyy-MM-dd');

            const updatePayload: any = { data: nextDateStr };

            if (isLead) {
              updatePayload.nextActionDate = nextDateStr;
            } else {
              // Preserve originalData — set it only if not already set (backward compat)
              updatePayload.originalData = (v as any).originalData || v.data;
            }
            
            batch.update(docRef, updatePayload);
          });
          await batch.commit();
          logger.log(`${visitsToMove.length} programări au fost amânate cu 1 zi.`, "info");
        } catch (err: any) {
          logger.log(`Eroare amânare în masă: ${err.message}`, "error");
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };


  const handleOpenFinish = (visit: Visit) => {
    const client = clients.find(c => c.id === visit.clientId);
    let suprafata = client?.suprafataMp || 0;

    // Precalculate next scheduled date for the UI
    let nextScheduledDateStrLocal: string | null = null;
    const propForDate = properties.find(p => p.id === visit.propertyId);
    const contractType = propForDate?.contractType || client?.contractType;
    const freq = propForDate?.maintenanceFrequency || client?.maintenanceFrequency || 'weekly';
    
    if (!visit.nextVisitScheduled && contractType === 'maintenance' && freq !== 'occasional') {
        let daysToAdd = 0;
        if (freq === 'weekly') daysToAdd = 7;
        else if (freq === 'biweekly') daysToAdd = 14;
        else if (freq === 'monthly') daysToAdd = 28;

        if (daysToAdd > 0) {
            let baseDate = new Date();
            if (visit.data && visit.data !== 'Fără dată') {
                const [y, m, d] = visit.data.split('-');
                baseDate = new Date(Number(y), Number(m)-1, Number(d));
            }
            baseDate.setDate(baseDate.getDate() + daysToAdd);
            baseDate.setHours(0, 0, 0, 0);
            baseDate = getNextWorkingDay(baseDate, workDays);
            nextScheduledDateStrLocal = format(baseDate, 'yyyy-MM-dd');
        }
    }
    
    setNextScheduledDateStr(nextScheduledDateStrLocal);
    setAutoRescheduleOverride(null);

    let matchedProp = null;
    if (visit.propertyId) {
      matchedProp = properties.find(p => p.id === visit.propertyId);
    }
    if (!matchedProp && visit.clientId) {
      const addr = visit.propertyAddress || visit.clientAddress;
      if (addr) {
        const normAddr = normalizeAddress(addr);
        matchedProp = properties.find(p => 
          p.clientId === visit.clientId && 
          (normalizeAddress(p.address) === normAddr || normalizeAddress(p.name) === normAddr)
        );
      }
    }
    if (matchedProp && matchedProp.surfaceArea) {
      suprafata = matchedProp.surfaceArea;
    }
    
    // Calculate current duration in hours
    const startTime = (visit.currentSessionStart && visit.currentSessionStart.toDate) ? visit.currentSessionStart.toDate() : new Date();
    const now = new Date();
    const durationHours = ((now.getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(2);

    const isAlreadyFinished = visit.status === 'Finalizat';
    const initial: Record<string, any> = {};
    
    if (isAlreadyFinished) {
        serviceTypes.forEach(st => {
           const existing = (visit.servicii_efectuate || []).find((s: any) => s.serviceId === st.id);
           if (existing) {
              initial[st.id] = { selected: true, quantity: existing.quantity ? existing.quantity.toString() : '' };
           } else {
              initial[st.id] = { selected: false, quantity: '' };
           }
        });
        setFinishNote(visit.finishNote || '');
        setInterventieCost(visit.interventieCost ? visit.interventieCost.toString() : '');
        setInterventieIncasata(visit.interventieIncasata || false);
    } else {
        const hasAnyDefault = serviceTypes.some(s => s.isDefault);
        
        serviceTypes.forEach(st => {
          let quantity = '';
          const unit = (st.unit || '').toLowerCase();
          
          const isSelected = hasAnyDefault ? st.isDefault : (st.name || '').toLowerCase().includes('tuns');

          if (isSelected) {
            if (unit === 'm²' || unit === 'mp' || unit === 'm2') {
              quantity = suprafata.toString();
            } else if (unit === 'ora' || unit === 'ore' || unit === 'h') {
              quantity = durationHours;
            }
          }

          initial[st.id] = { 
            selected: isSelected || false, 
            quantity: quantity
          };
        });
        
        setFinishNote('');
        
        // Occasional maintenance billing prep
        if (visit.propertyId) {
          const prop = properties.find(p => p.id === visit.propertyId);
          if (prop && prop.contractType === 'maintenance' && prop.maintenanceFrequency === 'occasional') {
            setInterventieCost(prop.tarifInterventie?.toString() || '');
            setInterventieIncasata(false);
          } else {
            setInterventieCost('');
            setInterventieIncasata(false);
          }
        } else {
          setInterventieCost('');
          setInterventieIncasata(false);
        }
    }

    setSelectedServices(initial);

    let initialDate = '';
    let initialStart = '';
    let initialEnd = '';
    if (isAlreadyFinished && visit.data && visit.data !== 'Fără dată') {
        const [y, m, d] = visit.data.split('-');
        initialDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else {
        initialDate = format(new Date(), 'yyyy-MM-dd');
    }
    
    if (visit.workSessions && visit.workSessions.length > 0) {
        const first = visit.workSessions[0].start?.toDate ? visit.workSessions[0].start.toDate() : new Date(visit.workSessions[0].start);
        const last = visit.workSessions[visit.workSessions.length - 1].end?.toDate ? visit.workSessions[visit.workSessions.length - 1].end.toDate() : new Date(visit.workSessions[visit.workSessions.length - 1].end);
        initialStart = first.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'});
        initialEnd = last.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'});
    } else {
        const now = new Date();
        const start = visit.currentSessionStart?.toDate ? visit.currentSessionStart.toDate() : new Date(now.getTime() - 60 * 60 * 1000);
        initialStart = start.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'});
        initialEnd = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'});
    }
    
    setEditVisitDate(initialDate);
    setEditVisitStartTime(initialStart);
    setEditVisitEndTime(initialEnd);

    setSelectedVisit(visit);
    setShowFinishModal(true);
  };

  const handleFinalize = useCallback(async () => {
    if (!selectedVisit || isProcessing) return;

    const execute = async () => {
      setIsProcessing(true);
      try {
        const startTime = (selectedVisit.currentSessionStart && selectedVisit.currentSessionStart.toDate) ? selectedVisit.currentSessionStart.toDate() : new Date();
        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      
      // Filter selected services to ensure they exist in current serviceTypes
      const finalServices = (Object.entries(selectedServices) as [string, {selected: boolean, quantity: string}][])
        .filter(([id, val]) => val.selected && serviceTypes.some(st => st.id === id))
        .map(([id, val]) => {
          const st = serviceTypes.find(s => s.id === id);
          return { serviceId: id, name: st?.name || 'Serviciu', quantity: val.quantity ? Number(val.quantity) : null, unit: st?.unit || null };
        });

      // Prepare history photos from existing visit photos
      const latestVisit = visits.find(v => v.id === selectedVisit.id) || selectedVisit;
      const historyPhotos = (latestVisit.photos || []).map(url => ({
        url,
        date: new Date().toISOString()
      }));

      // Get Property Name if exists
      let propertyId = selectedVisit.propertyId || '';
      let propertyName = '';
      let isOccasional = false;
      let propData = null;

      let matchedProp = null;
      if (selectedVisit.propertyId) {
        matchedProp = properties.find(p => p.id === selectedVisit.propertyId);
      }
      
      if (!matchedProp && selectedVisit.clientId) {
        const addr = selectedVisit.propertyAddress || selectedVisit.clientAddress;
        if (addr) {
          const normAddr = normalizeAddress(addr);
          matchedProp = properties.find(p => 
            p.clientId === selectedVisit.clientId && 
            (normalizeAddress(p.address) === normAddr || normalizeAddress(p.name) === normAddr)
          );
        }
      }

      if (matchedProp) {
        propertyId = matchedProp.id;
        propertyName = matchedProp.name;
        propData = matchedProp;
        if (matchedProp.contractType === 'maintenance' && matchedProp.maintenanceFrequency === 'occasional') {
           isOccasional = true;
        }
      }

      const isAlreadyFinished = selectedVisit.status === 'Finalizat';
      const batch = writeBatch(db);

      let newDataStr = editVisitDate || selectedVisit.data || format(new Date(), 'yyyy-MM-dd');
      let newHistoryDate = null;
      let sessionDur = 0;
      let newStartTime = new Date();
      let newEndTime = new Date();

      if (editVisitDate && editVisitStartTime && editVisitEndTime) {
          const [y, m, d] = editVisitDate.split('-');
          const [sh, sm] = editVisitStartTime.split(':');
          const [eh, em] = editVisitEndTime.split(':');
          newStartTime = new Date(Number(y), Number(m)-1, Number(d), Number(sh), Number(sm));
          newEndTime = new Date(Number(y), Number(m)-1, Number(d), Number(eh), Number(em));
          sessionDur = Math.round((newEndTime.getTime() - newStartTime.getTime()) / 60000);
          newHistoryDate = Timestamp.fromDate(newStartTime);
      } else {
          if (selectedVisit.currentSessionStart) {
              newStartTime = selectedVisit.currentSessionStart.toDate();
          } else {
              newStartTime.setMinutes(newStartTime.getMinutes() - 60);
          }
          sessionDur = Math.round((newEndTime.getTime() - newStartTime.getTime()) / 60000);
      }

      if (isAlreadyFinished) {
         let newWorkSessions = selectedVisit.workSessions;
         
         if (editVisitDate && editVisitStartTime && editVisitEndTime) {
             newWorkSessions = [{ start: Timestamp.fromDate(newStartTime), end: Timestamp.fromDate(newEndTime), duration: sessionDur > 0 ? sessionDur : 0 }];
         }

         batch.update(doc(db, 'visits', selectedVisit.id), {
            servicii_efectuate: finalServices,
            finishNote: finishNote || null,
            interventieCost: isOccasional ? Number(interventieCost) || 0 : null,
            interventieIncasata: isOccasional ? interventieIncasata : false,
            data: newDataStr,
            workSessions: newWorkSessions
         });
         
         // Try to find the history entry and update it
         const historyQ = query(collection(db, 'client_history'), where('visitId', '==', selectedVisit.id), where('organizationId', '==', organizationId));
         const historySnap = await getDocs(historyQ);
         historySnap.forEach(d => {
             batch.update(d.ref, {
                 details: finishNote ? `Raport editat. Notițe: ${finishNote}` : 'Raport editat.',
                 ...(newHistoryDate ? { date: newHistoryDate } : {})
             });
         });
         
      } else {
          const sortedServices = [...serviceTypes].sort((a,b) => (a.order||0) - (b.order||0));
          const tunsService = serviceTypes.find(s => (s.name || '').toLowerCase().includes('tuns'));
          const primaryService = tunsService || (sortedServices.length > 0 ? sortedServices[0] : null);
          const isMainServiceSelected = (Object.entries(selectedServices) as [string, {selected: boolean, quantity: string}][]).some(([id, val]) => {
             if (!val.selected) return false;
             return primaryService && id === primaryService.id;
          });
          const shouldAutoRescheduleEarly = isMainServiceSelected || autoRescheduleOverride === true;
          const isExtraServiceOnly = !isAlreadyFinished && !shouldAutoRescheduleEarly;

          const visitDataUpdate: any = {
            status: 'Finalizat', 
            completedAt: serverTimestamp(), 
            currentSessionStart: null,
            data: newDataStr,
            workSessions: [...(latestVisit.workSessions || []), { start: Timestamp.fromDate(newStartTime), end: Timestamp.fromDate(newEndTime), duration: sessionDur > 0 ? sessionDur : 0 }],
            servicii_efectuate: finalServices,
            finishNote: finishNote || null,
            interventieCost: isOccasional ? Number(interventieCost) || 0 : null,
            interventieIncasata: isOccasional ? interventieIncasata : false,
            ...(matchedProp && !selectedVisit.propertyId ? {
              propertyId: matchedProp.id,
              propertyAddress: matchedProp.address || selectedVisit.propertyAddress || '',
              propertyMapsLink: matchedProp.mapsLink || selectedVisit.propertyMapsLink || ''
            } : {})
          };

          let finalizedVisitId = selectedVisit.id;

          if (isExtraServiceOnly) {
              const extraVisitRef = doc(collection(db, 'visits'));
              finalizedVisitId = extraVisitRef.id;
              
              visitDataUpdate.workSessions = [{ start: Timestamp.fromDate(newStartTime), end: Timestamp.fromDate(newEndTime), duration: sessionDur > 0 ? sessionDur : 0 }];
              
              batch.set(extraVisitRef, {
                  ...selectedVisit,
                  ...visitDataUpdate,
                  id: extraVisitRef.id
              });

              if (selectedVisit.status === 'Activ') {
                 batch.update(doc(db, 'visits', selectedVisit.id), {
                    status: 'Programat',
                    currentSessionStart: null
                 });
              }
          } else {
              batch.update(doc(db, 'visits', selectedVisit.id), visitDataUpdate);
          }

          // Update Property Sold if Occasional and not paid
          if (isOccasional && !interventieIncasata && propData) {
             const cost = Number(interventieCost) || 0;
             if (cost > 0) {
                batch.update(doc(db, 'properties', propData.id), {
                   sold: (propData.sold || 0) + cost
                });
             }
          }

          // Save to Client History (inside batch for atomicity)
          const historyRef = doc(collection(db, 'client_history'));
          
          // Update lastSolidFertilizerDate if a fertilizer service was applied
          const isFertilizerApplied = finalServices.some(s => {
             const name = (s.name || '').toLowerCase();
             return name.includes('îngrășământ') || name.includes('ingrasamant') || name.includes('fertiliz');
          });

          if (isFertilizerApplied) {
             if (propData) {
                batch.update(doc(db, 'properties', propData.id), {
                   lastSolidFertilizerDate: newDataStr
                });
             } else if (selectedVisit.clientId) {
                batch.update(doc(db, 'clients', selectedVisit.clientId), {
                   lastSolidFertilizerDate: newDataStr
                });
             }
          }
          batch.set(historyRef, {
            clientId: selectedVisit.clientId,
            organizationId: organizationId,
            visitId: finalizedVisitId,
            propertyId: propertyId || null,
            propertyName: propertyName || null,
            type: 'visit_completion',
            date: serverTimestamp(),
            startTime: Timestamp.fromDate(newStartTime),
            services: finalServices,
            duration,
            performedBy: auth.currentUser?.uid,
            performedByName: auth.currentUser?.displayName || auth.currentUser?.email,
            photos: historyPhotos,
            details: isExtraServiceOnly 
                     ? (finishNote ? `Lucrare extra finalizată. Notițe: ${finishNote}` : 'Lucrare extra finalizată.')
                     : (finishNote ? `Lucrare finalizată. Notițe: ${finishNote}` : 'Lucrare finalizată.')
          });
      }

      // Log payment in history if paid on the spot
      if (isOccasional && interventieIncasata && Number(interventieCost) > 0 && !isAlreadyFinished) {
        const paymentRef = doc(collection(db, 'client_history'));
        batch.set(paymentRef, {
          clientId: selectedVisit.clientId,
          organizationId: organizationId,
          type: 'payment',
          amount: Number(interventieCost),
          date: serverTimestamp(),
          details: `Încasare intervenție ocazională${propertyName ? ` (${propertyName})` : ''}`,
          hidden: true
        });
      }

      // Delete future pending visits of the same type for the same property/client to avoid duplicates
      // We only do this for recurring maintenance visits, so we don't accidentally delete separate 'Lucrări unice'
      const isExtraServiceOnlyGlobal = !isAlreadyFinished && (() => {
          const sorted = [...serviceTypes].sort((a,b) => (a.order||0) - (b.order||0));
          const primary = sorted.length > 0 ? sorted[0] : null;
          const isMainSel = (Object.entries(selectedServices) as [string, {selected: boolean, quantity: string}][]).some(([id, val]) => {
             if (!val.selected) return false;
             return primary && id === primary.id;
          });
          return !(isMainSel || autoRescheduleOverride === true);
      })();

      if (!isAlreadyFinished && !isExtraServiceOnlyGlobal) {
        const isMaintenance = (propData?.contractType === 'maintenance' && propData?.maintenanceFrequency !== 'occasional') || 
                              (!propData && selectedVisit.tipLucrare === 'Mentenanță');
                              
        if (isMaintenance) {
          const futureDuplicates = visits.filter(v => 
            v.id !== selectedVisit.id &&
            v.clientId === selectedVisit.clientId &&
            v.propertyId === selectedVisit.propertyId &&
            v.tipLucrare === selectedVisit.tipLucrare &&
            (v.status === 'Programat' || v.status === 'Activ')
          );
          futureDuplicates.forEach(dup => {
            batch.delete(doc(db, 'visits', dup.id));
            logger.log(`Șters programare viitoare duplicată (${dup.data})`, "info");
          });
        }
      }

      // Route Recalculation Invalidation Logic
      if (!isAlreadyFinished && !isExtraServiceOnlyGlobal) {
         const todaysVisits = visits.filter(v => 
            v.data === newDataStr && 
            (v.status === 'Programat' || v.status === 'Activ') &&
            v.id !== selectedVisit.id
         ).sort((a, b) => {
            const aIdx = a.orderIndex !== undefined ? a.orderIndex : 999;
            const bIdx = b.orderIndex !== undefined ? b.orderIndex : 999;
            return aIdx - bIdx;
         });
         
         if (todaysVisits.length > 0) {
            const thisVisitOrder = selectedVisit.orderIndex !== undefined ? selectedVisit.orderIndex : 999;
            const firstRemainingOrder = todaysVisits[0].orderIndex !== undefined ? todaysVisits[0].orderIndex : 999;
            
            // If this visit has an order, and it's NOT the first in the sequence (i.e. we skipped earlier visits)
            if (thisVisitOrder > firstRemainingOrder && thisVisitOrder !== 999) {
               todaysVisits.forEach(v => {
                  if (v.orderIndex !== undefined) {
                     batch.update(doc(db, 'visits', v.id), { orderIndex: null });
                  }
               });
            }
         }
      }

      await batch.commit();

      // AUTO-SCHEDULE NEXT VISIT (Fallback for older visits)
      if (!selectedVisit.nextVisitScheduled) {
        const prop = properties.find(p => p.id === selectedVisit.propertyId);
        const client = clients.find(c => c.id === selectedVisit.clientId);
        // Read contractType and frequency from property first, fallback to client (legacy)
        const contractType = prop?.contractType || client?.contractType;
        const freq = prop?.maintenanceFrequency || client?.maintenanceFrequency || 'weekly';
        const shouldAutoReschedule = !isExtraServiceOnlyGlobal;

        // Allow autoRescheduleOverride to bypass the 'maintenance' check
        if (((contractType === 'maintenance' && freq !== 'occasional') || autoRescheduleOverride) && shouldAutoReschedule) {
            let daysToAdd = 7; // Default to 1 week if overriding an occasional visit
            if (freq === 'weekly') daysToAdd = 7;
            else if (freq === 'biweekly') daysToAdd = 14;
            else if (freq === 'monthly') daysToAdd = 28; // 4 weeks to keep the same day of the week

            if (daysToAdd > 0) {
                let nextDate = new Date(newEndTime);
                nextDate.setDate(nextDate.getDate() + daysToAdd);
                nextDate.setHours(0, 0, 0, 0);
                // Ensure the auto-scheduled date lands on a working day (BUG 4 fix)
                nextDate = getNextWorkingDay(nextDate, workDays);
                const hasFuture = await checkFutureVisitExists(client?.id || '', selectedVisit.propertyId || null);
                if (!hasFuture && client) {
                    await addDoc(collection(db, 'visits'), {
                        clientId: client.id,
                        clientName: client.nume || 'Client',
                        clientAddress: selectedVisit.propertyAddress || client.adresa || '',
                        organizationId,
                        status: 'Programat',
                        
                        data: format(nextDate, 'yyyy-MM-dd'),
                        oraProgramare: (selectedVisit.oraProgramare && selectedVisit.oraProgramare !== 'OFF') ? selectedVisit.oraProgramare : 'OFF',
                        tipLucrare: selectedVisit.tipLucrare || 'Mentenanță',
                        createdAt: serverTimestamp(),
                        propertyId: selectedVisit.propertyId || null,
                        propertyAddress: selectedVisit.propertyAddress || '',
                        propertyMapsLink: selectedVisit.propertyMapsLink || '',
                        assignedTo: selectedVisit.assignedTo || auth.currentUser?.uid,
                        assignedToName: selectedVisit.assignedToName || auth.currentUser?.displayName || auth.currentUser?.email
                    });
                    
                    await updateDoc(doc(db, 'visits', selectedVisit.id), {
                      nextVisitScheduled: true
                    });
                    
                    logger.log(t('Auto Scheduled', { name: client.nume, date: format(nextDate, 'dd/MM/yyyy') }), "success");
                }
            }
        }
      }

      setShowFinishModal(false);
      logger.log(`Finalizat: ${selectedVisit.clientName}`, "success");

      // If there was a pending start, start it now
      if (pendingStartVisitId) {
        const nextVisitId = pendingStartVisitId;
        setPendingStartVisitId(null);
        setIsProcessing(true);
        try {
          await updateDoc(doc(db, 'visits', nextVisitId), { status: 'Activ', currentSessionStart: serverTimestamp() });
          logger.log("Lucrare nouă începută automat", "info");
        } catch (err: any) { alert(err.message); }
        finally { setIsProcessing(false); }
      }
      } catch (err: any) { alert(err.message); }
      finally { setIsProcessing(false); }
    };

    const sortedServices = [...serviceTypes].sort((a,b) => (a.order||0) - (b.order||0));
    const tunsService = serviceTypes.find(s => (s.name || '').toLowerCase().includes('tuns'));
    const primaryService = tunsService || (sortedServices.length > 0 ? sortedServices[0] : null);
    const primaryServiceName = primaryService ? primaryService.name : 'Serviciul Principal';
    
    const isMainServiceSelected = (Object.entries(selectedServices) as [string, {selected: boolean, quantity: string}][]).some(([id, val]) => {
        if (!val.selected) return false;
        return primaryService && id === primaryService.id;
    });

    const isAlreadyFinished = selectedVisit.status === 'Finalizat';

    if (!isAlreadyFinished && !isMainServiceSelected && !autoRescheduleOverride) {
        setConfirmationModal({
            title: "Lucrare Extra",
            message: `Atenție! Ai debifat serviciul principal (${primaryServiceName}). Raportul se va salva ca o lucrare extra, iar programarea curentă va rămâne activă pe ecran ca să te poți întoarce altă dată. Ești sigur că vrei să continui?`,
            onConfirm: async () => {
                await execute();
            }
        });
        return;
    }

    await execute();
  }, [selectedVisit, isProcessing, selectedServices, serviceTypes, organizationId, pendingStartVisitId, finishNote, interventieCost, interventieIncasata, editVisitDate, editVisitStartTime, editVisitEndTime, autoRescheduleOverride]);

  const grouped = useMemo(() => {
    const g: Record<string, Visit[]> = { 'Today': [], 'Planned': [], 'Archive': [] };
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Filter visits based on role
    const filteredVisits = userRole === 'admin' 
      ? visits 
      : visits.filter(v => v.assignedTo === auth.currentUser?.uid || !v.assignedTo);

    filteredVisits.forEach(v => {
      if (v.status === 'Finalizat') {
        g['Archive'].push(v);
        return;
      }
      
      const vDateISO = v.data ? format(parseSafeDate(v.data), 'yyyy-MM-dd') : null;
      
      if (v.data) {
        // Do not filter out explicitly scheduled visits based on workDays
      }
      
      const isLead = (v as any).isLead;
      if (vDateISO === today) {
        g['Today'].push(v);
      } else if (vDateISO && vDateISO < today) {
        if (isLead) {
          // Overdue leads don't jump to today, move to archive for visibility but not in active list
          g['Archive'].push(v);
        } else {
          // Maintenance visits jump to today (or are about to be rescheduled)
          g['Today'].push(v);
        }
      } else {
        g['Planned'].push(v);
      }
    });
    
    // Explicit sorting for each group
    if (sortByDistance && userLocation) {
        // Greedy Nearest Neighbor Sort for Today
        const unsorted = [...g['Today']];
        const sorted: Visit[] = [];
        let currentLat = userLocation.lat;
        let currentLng = userLocation.lng;

        while (unsorted.length > 0) {
            let nearestIdx = -1;
            let minDistance = Infinity;

            for (let i = 0; i < unsorted.length; i++) {
                const v = unsorted[i];
                const client = clients.find(c => c.id === v.clientId);
                const property = properties.find(p => p.id === v.propertyId);
                
                // Prioritize property coords, then client coords
                const lat = property?.latitude || client?.latitude;
                const lng = property?.longitude || client?.longitude;

                if (lat && lng) {
                    const dist = getDistanceFromLatLonInKm(currentLat, currentLng, lat, lng);
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestIdx = i;
                    }
                } else {
                    // If no coords, treat as very far (or just append at end)
                    // For now, let's just consider them 'far' but prioritize ones with coords
                }
            }

            if (nearestIdx !== -1) {
                const nearest = unsorted[nearestIdx];
                sorted.push(nearest);
                
                // Update current location to this visit's location
                const client = clients.find(c => c.id === nearest.clientId);
                const property = properties.find(p => p.id === nearest.propertyId);
                const lat = property?.latitude || client?.latitude;
                const lng = property?.longitude || client?.longitude;
                
                if (lat && lng) {
                    currentLat = lat;
                    currentLng = lng;
                }
                
                unsorted.splice(nearestIdx, 1);
            } else {
                // Remaining items have no coordinates, just append them
                sorted.push(...unsorted);
                break;
            }
        }
        g['Today'] = sorted;
    } else {
        g['Today'].sort((a, b) => {
          const aIsLead = (a as any).isLead;
          const bIsLead = (b as any).isLead;
          if (aIsLead && !bIsLead) return -1;
          if (!aIsLead && bIsLead) return 1;
          return (a.clientName || '').localeCompare(b.clientName || '');
        });
    }

    g['Planned'].sort((a, b) => {
      const aDate = a.data || '';
      const bDate = b.data || '';
      const dComp = aDate.localeCompare(bDate);
      if (dComp !== 0) return dComp;
      const aIsLead = (a as any).isLead;
      const bIsLead = (b as any).isLead;
      if (aIsLead && !bIsLead) return -1;
      if (!aIsLead && bIsLead) return 1;
      return (a.clientName || '').localeCompare(b.clientName || '');
    });
    
    // Sort Archive by completion date descending
    g['Archive'].sort((a, b) => (b.completedAt?.toMillis() || 0) - (a.completedAt?.toMillis() || 0));
    
    return g;
  // Bug #2 fix: dependency array complet — sortarea după distanță funcționează acum
  }, [visits, userRole, sortByDistance, userLocation, clients, properties]);

  const calendarEvents = useMemo(() => {
    return visits.map(v => {
      const client = clients.find(c => c.id === v.clientId);
      const displayName = client?.tip_persoana === 'PJ' 
        ? (client.numeFirma || client.nume) 
        : (client?.nume || v.clientName || 'Programare');
      
      return {
        id: v.id,
        title: displayName,
        start: new Date(`${v.data}T09:00`),
        end: new Date(`${v.data}T10:00`),
        resource: v
      };
    });
  }, [visits, clients]);

  const resetForm = useCallback(() => {
    let defaultClientId = '';
    let defaultPropertyId = '';
    let defaultPropertyAddress = '';
    let defaultPropertyMapsLink = '';

    if (isPF && clients.length > 0) {
      defaultClientId = clients[0].id;
      const clientProps = properties.filter(p => p.clientId === defaultClientId);
      if (clientProps.length > 0) {
        defaultPropertyId = clientProps[0].id;
        defaultPropertyAddress = clientProps[0].address || '';
        defaultPropertyMapsLink = clientProps[0].mapsLink || '';
      }
    }

    setFormData({
      clientId: defaultClientId,
      tipLucrare: serviceTypes.find(st => st.isDefault)?.name || serviceTypes[0]?.name || 'Mentenanță',
      status: 'Programat',
      data: format(new Date(), 'yyyy-MM-dd'),
      oraProgramare: 'OFF',
      detalii: '',
      assignedTo: auth.currentUser?.uid || '',
      propertyId: defaultPropertyId,
      propertyAddress: defaultPropertyAddress,
      propertyMapsLink: defaultPropertyMapsLink
    });
    setIsEditing(false);
    setEditingVisitId(null);
  }, [serviceTypes, isPF, clients, properties]);

  const handleAddMission = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.clientId || isProcessing) return;
    
    if (!formData.assignedTo) {
      toast.error("Te rugăm să asignezi lucrarea unui angajat.");
      return;
    }

    if (formData.data) {
      const selectedDate = parseSafeDate(formData.data);
      if (!isNaN(selectedDate.getTime())) {
        // Prevent past dates
        const today = new Date();
        today.setHours(0,0,0,0);
        if (selectedDate < today) {
           const originalVisit = isEditing ? visits.find(v => v.id === editingVisitId) : null;
           if (!isEditing || !originalVisit) {
               toast.error("Nu poți programa o lucrare pentru o dată din trecut.");
               return;
           } else {
               const originalParsed = parseSafeDate(originalVisit.data);
               if (selectedDate.getTime() !== originalParsed.getTime()) {
                   toast.error("Nu poți reprograma o lucrare pentru o dată din trecut.");
                   return;
               }
           }
        }

        const dayOfWeek = getDay(selectedDate);
        if (workDays === 'L-V' && (dayOfWeek === 0 || dayOfWeek === 6)) {
          toast.error("Zilele de weekend nu sunt lucrătoare conform programului firmei (L-V).");
          return;
        }
        if (workDays === 'L-S' && dayOfWeek === 0) {
          toast.error("Duminica nu este zi lucrătoare conform programului firmei (L-S).");
          return;
        }
      } else {
        toast.error("Data introdusă este invalidă. Folosește formatul Zi.Lună.An (ex: 4.6.2026)");
        return;
      }
    }

    // Prevent scheduling multiple visits for the SAME property
    const existingVisit = visits.find(v => 
      v.clientId === formData.clientId && 
      v.propertyId === (formData.propertyId || null) &&
      (v.status === 'Programat' || v.status === 'Activ') &&
      (!isEditing || v.id !== editingVisitId)
    );

    if (existingVisit) {
      toast.error("Acest client are deja o vizită programată. Nu poți programa două vizite în viitor pentru același client.");
      return;
    }

    setIsProcessing(true);
    try {
      const client = clients.find(c => c.id === formData.clientId);
      if (!client) throw new Error("Clientul nu a fost găsit.");
      
      let assignedToName = '';
      if (formData.assignedTo) {
        const emp = employees.find(e => e.uid === formData.assignedTo);
        if (emp) assignedToName = emp.displayName || emp.email;
      }

      // Ensure date is explicitly formatted to yyyy-MM-dd for the database
      let formattedDate = formData.data;
      if (formData.data) {
          const d = parseSafeDate(formData.data);
          if (d && !isNaN(d.getTime())) {
              formattedDate = format(d, 'yyyy-MM-dd');
          }
      }

      // Strip undefined values to prevent Firestore errors, and exclude time fields if not editing a past completed visit
      const cleanData = Object.fromEntries(
        Object.entries({ ...formData, data: formattedDate }).filter(([k, v]) => {
          if (v === undefined) return false;
          if ((k === 'oraInceput' || k === 'oraSfarsit') && (!isEditing || formData.status !== 'Finalizat')) {
            return false;
          }
          return true;
        })
      );

      // No more scheduledDate

      if (isEditing && editingVisitId) {
        // Never overwrite originalData after creation — it's the immutable creation date
        await updateDoc(doc(db, 'visits', editingVisitId), {
          ...cleanData,
          clientName: client.nume,
          clientId: client.id,
          assignedToName,
          // originalData is NOT updated here — it was set at creation and must remain unchanged
        });
        
        if (formData.status === 'Finalizat' && formData.servicii_efectuate) {
          const isFertilizerApplied = formData.servicii_efectuate.some((s: any) => {
             const name = (s.name || '').toLowerCase();
             return name.includes('îngrășământ') || name.includes('ingrasamant') || name.includes('fertiliz');
          });
          if (isFertilizerApplied) {
             const newDataStr = formattedDate || format(new Date(), 'yyyy-MM-dd');
             if (formData.propertyId) {
                await updateDoc(doc(db, 'properties', formData.propertyId), {
                   lastSolidFertilizerDate: newDataStr
                });
             } else {
                await updateDoc(doc(db, 'clients', formData.clientId), {
                   lastSolidFertilizerDate: newDataStr
                });
             }
          }
        }
        
        logger.log("Programare actualizată", "success");
      } else {
        // On creation: save originalData = data (the immutable creation date)
        await addDoc(collection(db, 'visits'), {
          ...cleanData,
          clientName: client.nume,
          clientId: client.id,
          organizationId,
          status: 'Programat',
          createdAt: serverTimestamp(),
          assignedToName,
          originalData: formattedDate, // immutable creation date for reprogrammed tracking
        });
        logger.log("Programare adăugată", "success");
      }

      setShowModal(false);
      resetForm();
    } catch (err: any) { 
      console.error("Error saving mission:", err);
      alert(`Eroare: ${err.message}`); 
    }
    finally { setIsProcessing(false); }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showModal) return;
      
      if (event.key === 'Escape') {
        setShowModal(false);
        resetForm();
      }
    };

    if (showModal) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal, resetForm]);

  const handleEditClick = (visit: Visit, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if ((visit as any).isLead) {
        setSelectedLead((visit as any).leadData);
        setShowEditLeadModal(true);
        return;
    }
    setFormData({
      clientId: visit.clientId || '',
      tipLucrare: visit.tipLucrare || '',
      status: visit.status || 'Programat',
      data: visit.data || '',
      oraProgramare: visit.oraProgramare || '',
      oraInceput: visit.oraInceput || '',
      oraSfarsit: visit.oraSfarsit || '',
      detalii: visit.detalii || '',
      assignedTo: visit.assignedTo || auth.currentUser?.uid || '',
      propertyId: visit.propertyId || '',
      propertyAddress: visit.propertyAddress || '',
      propertyMapsLink: visit.propertyMapsLink || ''
    });
    setIsEditing(true);
    setEditingVisitId(visit.id);
    setShowModal(true);
  };

  const handleDeleteClick = (visit: Visit, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if ((visit as any).isLead) {
        const lead = (visit as any).leadData;
        setConfirmationModal({
          title: "Ștergere Lead",
          message: t('Are you sure you want to delete the lead for {{name}}? This action is irreversible.', { name: lead.nume }),
          onConfirm: async () => {
            try {
              await deleteDoc(doc(db, 'leads', lead.id));
            } catch (err) {
              console.error("Error deleting lead:", err);
            }
          }
        });
        return;
    }
    setConfirmationModal({
      title: "Ștergere Programare",
      message: t('Are you sure you want to delete the appointment for {{name}}? This action is irreversible and will delete associated photos and history.', { name: visit.clientName }),
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);

          // 1. Delete Firestore Document
          batch.delete(doc(db, 'visits', visit.id));

          // 2. Delete History Entries
          const historyQ = query(collection(db, 'client_history'), where('visitId', '==', visit.id), where('organizationId', '==', organizationId));
          const historySnap = await getDocs(historyQ);
          historySnap.forEach(d => batch.delete(d.ref));

          await batch.commit();

          // 3. Delete Photos from Storage if they exist
          if (visit.photos && visit.photos.length > 0) {
            const visitFolderRef = ref(storage, `uploads/${organizationId}/${auth.currentUser?.uid}/${visit.clientId}/visits/${visit.id}`);
            const deleteFolder = async (folderRef: any) => {
              try {
                const list = await listAll(folderRef);
                await Promise.all(list.items.map(item => deleteObject(item)));
                await Promise.all(list.prefixes.map(prefix => deleteFolder(prefix)));
              } catch (err: any) {
                // Ignore if folder doesn't exist
              }
            };
            await deleteFolder(visitFolderRef);
          }

          logger.log("Programare și datele asociate șterse", "warn");
        } catch (err: any) {
          logger.log(`Eroare ștergere: ${err.message}`, "error");
          alert(`Eroare ștergere: ${err.message}`);
        }
      }
    });
  };

  const handleClearArchive = () => {
    const archivedVisits = grouped['Archive'];
    if (archivedVisits.length === 0) return;

    setConfirmationModal({
      title: "Golire Arhivă",
      message: t('Are you sure you want to delete ALL {{count}} completed visits? This action is irreversible and will delete associated photos and history.', { count: archivedVisits.length }),
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          // Batch deletion in chunks
          const chunks = [];
          for (let i = 0; i < archivedVisits.length; i += 200) { // Reduced batch size to accommodate history deletes
            chunks.push(archivedVisits.slice(i, i + 200));
          }

          for (const chunk of chunks) {
            const batch = writeBatch(db);
            
            for (const v of chunk) {
              // Delete Visit
              batch.delete(doc(db, 'visits', v.id));

              // Delete History
              const historyQ = query(collection(db, 'client_history'), where('visitId', '==', v.id), where('organizationId', '==', organizationId));
              const historySnap = await getDocs(historyQ);
              historySnap.forEach(d => batch.delete(d.ref));
              
              // Delete Storage (Async)
              if (v.photos && v.photos.length > 0) {
                const visitFolderRef = ref(storage, `uploads/${organizationId}/${auth.currentUser?.uid}/${v.clientId}/visits/${v.id}`);
                const deleteFolder = async (folderRef: any) => {
                  try {
                    const list = await listAll(folderRef);
                    await Promise.all(list.items.map(item => deleteObject(item)));
                    await Promise.all(list.prefixes.map(prefix => deleteFolder(prefix)));
                  } catch (err) { }
                };
                deleteFolder(visitFolderRef);
              }
            }
            await batch.commit();
          }
          logger.log(t('Archive cleared successfully'), "success");
        } catch (err: any) {
          logger.log(t('Archive clear error: {{message}}', { message: err.message }), "error");
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const stats = useMemo(() => {
    return {
      total: grouped['Today'].length + grouped['Planned'].length + grouped['Archive'].length,
      active: grouped['Today'].length,
      scheduled: grouped['Planned'].length,
      archived: grouped['Archive'].length
    };
  }, [grouped]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, visit: Visit) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsProcessing(true);
    const files = Array.from(e.target.files);
    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        const compressedFile = await compressImage(file);
        const storageRef = ref(storage, `uploads/${organizationId}/${auth.currentUser?.uid}/${visit.clientId}/visits/${visit.id}/${Date.now()}_${file.name}`);
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

      // Update Client History
      const historyQ = query(collection(db, 'client_history'), where('visitId', '==', visit.id), where('organizationId', '==', organizationId));
      const historySnap = await getDocs(historyQ);
      if (!historySnap.empty) {
        const historyDoc = historySnap.docs[0];
        // Bug #4 fix: format consistent {url, date} ca în handleVisitPhotoUpload
        const historyPhotosFormatted = uploadedUrls.map(url => ({ url, date: new Date().toISOString() }));
        const existingHistoryPhotos = historyDoc.data().photos || [];
        await updateDoc(historyDoc.ref, {
          photos: [...existingHistoryPhotos, ...historyPhotosFormatted]
        });
      } else {
        // If no history exists (rare for completed visits), create it
        const historyPhotosFormatted = uploadedUrls.map(url => ({ url, date: new Date().toISOString() }));
        await addDoc(collection(db, 'client_history'), {
            clientId: visit.clientId,
            visitId: visit.id,
            date: visit.data,
            type: 'visit',
            details: t('Visit completed') + ` - ${visit.servicii_efectuate?.map(s => s.name).join(', ') || t('Maintenance')}`,
            photos: historyPhotosFormatted,
            organizationId
        });
      }

      logger.log(t('Upload Success', { count: files.length }), "success");
    } catch (error: any) {
      logger.log(t('Upload Error', { message: error.message }), "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<Record<string, number>>({});
  useEffect(() => {
    const handleMobileAdd = (e: any) => {
      if (e.detail.page === 'Schedule') {
        setShowModal(true);
      }
    };
    window.addEventListener('ls_mobile_add_click', handleMobileAdd);
    return () => window.removeEventListener('ls_mobile_add_click', handleMobileAdd);
  }, []);

  const handlePrevPhoto = (e: React.MouseEvent, visitId: string, total: number) => {
    e.stopPropagation();
    setCurrentPhotoIndex(prev => ({
        ...prev,
        [visitId]: (prev[visitId] || 0) === 0 ? total - 1 : (prev[visitId] || 0) - 1
    }));
  };

  const handleNextPhoto = (e: React.MouseEvent, visitId: string, total: number) => {
    e.stopPropagation();
    setCurrentPhotoIndex(prev => ({
        ...prev,
        [visitId]: (prev[visitId] || 0) === total - 1 ? 0 : (prev[visitId] || 0) + 1
    }));
  };

  const renderCard = (v: Visit) => {
    const isCompleted = v.status === 'Finalizat';
    const isActive = v.status === 'Activ';
    const isLead = (v as any).isLead;
    const leadData = (v as any).leadData;
    const client = clients.find(c => c.id === v.clientId);
    
    // Location Logic
    const property = properties.find(p => p.id === v.propertyId);
    const displayAddress = v.propertyAddress || property?.address || client?.adresa || t('No Address');
    const mapsLink = getMapsUrl(displayAddress, v.propertyMapsLink || property?.mapsLink || client?.Maps_link);
    
    const phone = isLead ? leadData?.telefon : client?.telefon;
    const cleanPhone = (phone || '').replace(/[^0-9+]/g, '');
    const waLink = `https://wa.me/${cleanPhone.startsWith('0') ? '4' + cleanPhone : cleanPhone}`;

    // Format times for archived cards
    let timeRange = '';
    let durationText = '';
    if (isCompleted && v.workSessions && v.workSessions.length > 0) {
      const first = v.workSessions[0].start?.toDate ? v.workSessions[0].start.toDate() : (v.workSessions[0].start ? new Date(v.workSessions[0].start) : null);
      const last = v.workSessions[v.workSessions.length - 1].end?.toDate ? v.workSessions[v.workSessions.length - 1].end.toDate() : (v.workSessions[v.workSessions.length - 1].end ? new Date(v.workSessions[v.workSessions.length - 1].end) : null);
      if (first && last) {
        timeRange = `${first.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${last.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        const diffMinutes = calculateTotalDuration(v.workSessions);
        const hours = Math.floor(diffMinutes / 60);
        const mins = Math.round(diffMinutes % 60);
        durationText = `${hours}h ${mins}m`;
      }
    }

    const maintenanceFreqMap: Record<string, string> = {
      'weekly': t('Weekly_Short'),
      'biweekly': t('Biweekly_Short'),
      'monthly': t('Monthly'),
      'occasional': t('Occasional')
    };
    const freq = property?.maintenanceFrequency || client?.maintenanceFrequency;
    const maintenanceText = freq ? maintenanceFreqMap[freq] : t('One-time');

    // Date Badge Logic
    const today = new Date();

    const visitDate = v.data ? parseSafeDate(v.data) : new Date();

    // Find last visit date and calculate days relative to the scheduled visit date
    const diffDays = isCompleted
      ? calculateDaysSinceVisitCompleted(v)
      : calculateDaysSinceLastVisit(visits, v.clientId, v.propertyId, v.id);
    
    const maintenanceTextWithDate = maintenanceText;

    // ─── Reprogrammed: derived dynamically from originalData (never from boolean flag) ───
    // A visit is reprogrammed if its current date differs from its creation date.
    // For old visits without originalData, originalData defaults to data (not reprogrammed).
    const isReprogrammed = !!(v.originalData && v.data !== v.originalData);
    const originalDataFormatted = isReprogrammed && v.originalData 
      ? (() => { try { return format(parseSafeDate(v.originalData), 'd MMM', { locale: currentLocale }); } catch { return v.originalData; } })()
      : null;

    const assignedEmployee = employees.find(e => e.uid === v.assignedTo);
    
    let employeeName = t('Not Assigned');
    if (assignedEmployee?.displayName) {
        employeeName = assignedEmployee.displayName;
    } else if (v.assignedToName && !v.assignedToName.includes('@')) {
        employeeName = v.assignedToName;
    } else if (assignedEmployee?.email) {
        employeeName = assignedEmployee.email.split('@')[0].split(/[._]/).map((p:string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    } else if (v.assignedToName) {
        employeeName = v.assignedToName.split('@')[0].split(/[._]/).map((p:string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    const isInvalidDate = isNaN(visitDate.getTime());
    const isToday = !isInvalidDate && visitDate.toDateString() === today.toDateString();
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = !isInvalidDate && visitDate.toDateString() === tomorrow.toDateString();

    let dateBadgeLabel = '';
    let badgeColor = 'bg-accent-color';
    
    if (isLead) {
        dateBadgeLabel = 'LEAD';
        badgeColor = 'bg-purple-500';
    } else if (isInvalidDate) {
        dateBadgeLabel = '???';
        badgeColor = 'bg-gray-400';
    } else if (isToday) {
        dateBadgeLabel = t('Today').toUpperCase();
        badgeColor = 'bg-red-500';
    } else if (isTomorrow) {
        dateBadgeLabel = t('Tomorrow').toUpperCase();
        badgeColor = 'bg-blue-500';
    } else {
        dateBadgeLabel = format(visitDate, 'd MMMM', { locale: currentLocale });
        badgeColor = 'bg-accent-color';
    }

    if (isLead) {
        const isOfertat = leadData?.status === 'ofertat';
        let shouldPulsate = false;
        
        if (isOfertat && leadData?.ofertatAt) {
            const ofertatDate = leadData.ofertatAt.toDate ? leadData.ofertatAt.toDate() : new Date(leadData.ofertatAt);
            const diffTime = Math.abs(new Date().getTime() - ofertatDate.getTime());
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 7) {
                shouldPulsate = true;
            }
        }

        return (
            <div 
                key={v.id} 
                className="bg-lead-accent hover:bg-lead-accent-hover border border-accent-color/20 dark:border-accent-color/30 rounded-2xl p-3 pb-8 shadow-sm hover:shadow-md transition-all duration-200 group relative flex flex-col mb-4 break-inside-avoid h-auto"
            >
                {/* Row 1: Name, Status, Icons */}
                <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                        <h3 
                            onClick={() => handleEditClick(v)}
                            className={`text-base font-black text-accent-color truncate cursor-pointer hover:underline px-1 rounded ${shouldPulsate ? 'animate-pulsate-bg' : ''}`}
                        >
                            {v.clientName}
                        </h3>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowHistoryModal({ clientId: v.clientId, clientName: v.clientName, propertyId: v.propertyId, propertyName: v.propertyAddress }); }}
                            className="p-1 text-text-secondary hover:text-accent-color hover:bg-accent-color/10 rounded-lg transition-all shrink-0 flex items-center gap-1"
                            title={t('Service History')}
                        >
                            <History size={14} />
                            {diffDays !== null && <span className="text-[12.5px] font-bold italic">[{diffDays}z]</span>}
                        </button>
                        <span className="text-[11px] font-bold uppercase px-1.5 py-0.5 rounded bg-accent-color/10 text-accent-color whitespace-nowrap">
                            {leadData.status}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleConvertToClient(leadData); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-accent-color hover:bg-accent-color/10 transition-all border border-accent-color/20"
                            title={t('Convert to Client')}
                        >
                            <UserPlus size={14} />
                        </button>
                        <button 
                            onClick={(e) => handleEditClick(v, e)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:bg-black/5 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/10"
                            title={t('Edit')}
                        >
                            <Edit2 size={14} />
                        </button>
                        <button 
                            onClick={(e) => handleDeleteClick(v, e)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all border border-black/5 dark:border-white/10"
                            title={t('Delete')}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Row 2: Phone and Address */}
                <div className="flex items-center gap-3 mb-2 text-[11px] font-bold text-main">
                    <a href={`tel:${cleanPhone}`} className="flex items-center gap-1 hover:text-green-600 transition-colors">
                        <Phone size={12} className="text-green-500" />
                        {phone}
                    </a>
                    <div className="flex items-center gap-1.5 truncate">
                        <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600 transition-colors truncate">
                            <MapPin size={12} className="text-accent-color" />
                            <span className="truncate">{displayAddress}</span>
                        </a>
                        {v.propertyId && properties.find(p => p.id === v.propertyId)?.irrigation && (
                            <Droplets 
                                size={12} 
                                className={isIrrigatingToday(properties.find(p => p.id === v.propertyId)!, visitDate) ? "text-blue-500 flex-shrink-0" : "text-gray-300 flex-shrink-0"} 
                            />
                        )}
                    </div>
                </div>

                {/* Row 3: Notes (2 lines) */}
                {leadData.notite && (
                    <div className="mb-3">
                        <p className="text-[11px] text-text-secondary leading-tight line-clamp-2 italic">
                            {leadData.notite}
                        </p>
                    </div>
                )}

                {/* Status Buttons (compact) */}
                <div className="flex flex-wrap gap-1 mb-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); updateLeadStatus(leadData.id, 'vizualizat'); }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all border ${leadData.status === 'vizualizat' ? 'bg-blue-500 text-white border-blue-600' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
                    >
                        {t('Contacted')}
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); updateLeadStatus(leadData.id, 'ofertat'); }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all border ${leadData.status === 'ofertat' ? 'bg-orange-500 text-white border-orange-600' : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100'}`}
                    >
                        {t('Waiting Confirmation')}
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); updateLeadStatus(leadData.id, 'confirmat'); }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all border ${leadData.status === 'confirmat' ? 'bg-green-500 text-white border-green-600' : 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'}`}
                    >
                        {t('Confirmed')}
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); updateLeadStatus(leadData.id, 'pierdut'); }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all border ${leadData.status === 'pierdut' ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}
                    >
                        {t('Lost')}
                    </button>
                </div>

                {/* Lost Reason if applicable */}
                {leadData.status === 'pierdut' && leadData.lostReason && (
                    <div className="mb-2 text-[11px] text-red-500 font-medium text-center bg-red-50 dark:bg-red-900/20 py-1 rounded-lg border border-red-100 dark:border-red-800/30">
                        {t('Reason')}: {leadData.lostReason}
                    </div>
                )}

                {/* Date Badge: Bottom Left */}
                <div className="absolute bottom-1 left-1 flex items-center gap-1">
                    {v.reprogrammed && (
                        <div className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider shadow-sm" title={v.originalData ? `Reprogramat din ${formatLongDate(parseSafeDate(v.originalData))}` : t('Reprogrammed')}>
                            {t('Reprogrammed')}
                        </div>
                    )}
                    <div className={`${badgeColor} text-white px-2 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider shadow-sm`}>
                        {dateBadgeLabel}
                    </div>
                </div>
            </div>
        );
    }

    if (isCompleted) {
        const companyName = client?.tip_persoana === 'PJ' ? client.numeFirma : '';
        const contactName = client?.nume || v.clientName || t('Unknown Client');
        const displayName = companyName ? `${companyName} (${contactName})` : contactName;

        return (
            <div 
                key={v.id} 
                className="bg-bg-card border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col mb-4 break-inside-avoid h-auto relative"
            >
                <div className="flex justify-between items-start mb-2 gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                        <h3 
                            onClick={() => onNavigate(Page.Details, v.clientId)}
                            className="text-sm font-black text-main leading-tight cursor-pointer hover:text-accent-color transition-colors truncate"
                        >
                            {displayName}
                        </h3>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowHistoryModal({ clientId: v.clientId, clientName: displayName, propertyId: v.propertyId, propertyName: v.propertyAddress }); }}
                            className="p-1 text-text-secondary hover:text-accent-color hover:bg-accent-color/10 rounded-lg transition-all shrink-0 flex items-center gap-1"
                            title={t('Service History')}
                        >
                            <History size={14} />
                            {diffDays !== null && <span className="text-[12.5px] font-bold italic">[{diffDays}z]</span>}
                        </button>
                    </div>
                    <div className="flex gap-1">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHistoryVisitId(v.id);
                                historyFileInputRef.current?.click();
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-text-secondary bg-bg-main hover:bg-accent-color/10 hover:text-accent-color transition-all"
                            title={t('Add Photo')}
                            disabled={uploadingId === v.id}
                        >
                            {uploadingId === v.id ? (
                                <div className="w-3 h-3 border-2 border-accent-color border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <Upload size={14} strokeWidth={1.5} />
                            )}
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setFinishNote(v.finishNote || '');
                                setShowNoteModal({visit: v, type: v.finishNote ? 'view' : 'add'});
                            }}
                            className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${
                                v.finishNote 
                                    ? 'text-white bg-accent-color hover:bg-accent-color/90 shadow-sm' 
                                    : 'text-text-secondary bg-bg-main hover:bg-accent-color/10 hover:text-accent-color'
                            }`}
                            title={v.finishNote ? t("View Note") : t("Add Note")}
                        >
                            {v.finishNote ? (
                                <NotebookText size={14} strokeWidth={2} />
                            ) : (
                                <Notebook size={14} strokeWidth={1.5} />
                            )}
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenFinish(v);
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-text-secondary hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                            title={t("Edit Report")}
                        >
                            <Edit2 size={14} strokeWidth={1.5} />
                        </button>
                        <button 
                            onClick={(e) => handleDeleteClick(v, e)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            title={t("Delete")}
                        >
                            <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 mb-3 truncate">
                    <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary hover:text-blue-500 hover:underline truncate">
                        <MapPin size={12} className="text-accent-color flex-shrink-0" />
                        <span className="truncate">{displayAddress}</span>
                    </a>
                    {v.propertyId && properties.find(p => p.id === v.propertyId)?.irrigation && (
                        <Droplets 
                            size={12} 
                            className={isIrrigatingToday(properties.find(p => p.id === v.propertyId)!, visitDate) ? "text-blue-500 flex-shrink-0" : "text-gray-300 flex-shrink-0"} 
                        />
                    )}
                </div>

                <div className="flex items-center gap-2 mb-3 text-[11px] font-bold text-text-secondary">
                    <CalendarIcon size={12} className="text-accent-color" />
                    <span>{v.data && v.data !== 'Fără dată' ? formatLongDate(parseSafeDate(v.data)) : t('No Date')}</span>
                    {timeRange && (
                        <>
                            <span>•</span>
                            <span>{timeRange} ({durationText})</span>
                        </>
                    )}
                </div>

                {v.servicii_efectuate && v.servicii_efectuate.length > 0 && (
                    <div className="mb-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1">{t('Performed Services')}:</div>
                        <div className="flex flex-wrap gap-1">
                            {v.servicii_efectuate.map((s, idx) => (
                                <span key={idx} className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-[11px] font-bold text-main border border-black/5">
                                    {s.name} {s.quantity ? `(${s.quantity} ${s.unit || ''})` : ''}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {v.finishNote && (
                    <div className="mb-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1">{t('Note')}:</div>
                        <div 
                            className="bg-accent-color/5 border border-accent-color/10 rounded-lg p-2 cursor-pointer transition-colors hover:bg-accent-color/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpandedNotes(prev => ({ ...prev, [v.id]: !prev[v.id] }));
                            }}
                        >
                            <p className={`text-[11px] font-medium text-main leading-tight ${!expandedNotes[v.id] ? 'line-clamp-1' : 'whitespace-pre-wrap'}`}>
                                {v.finishNote}
                            </p>
                        </div>
                    </div>
                )}

                {v.photos && v.photos.length > 0 && (
                    <div className="mt-2">
                        <div className="relative group/photo cursor-pointer overflow-hidden rounded-xl border border-black/10 shadow-sm" onClick={(e) => { e.stopPropagation(); setPhotoViewer(v.photos![currentPhotoIndex[v.id] || 0]); }}>
                            <img 
                                src={v.photos[currentPhotoIndex[v.id] || 0]} 
                                alt="Lucrare" 
                                className="w-full h-32 object-cover transition-transform duration-500 group-hover/photo:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/photo:opacity-100">
                                <Maximize2 className="text-white drop-shadow-md" size={24} />
                            </div>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePhoto(v.id, v.photos![currentPhotoIndex[v.id] || 0]);
                                }}
                                className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover/photo:opacity-100 transition-opacity focus:opacity-100 z-10"
                                title={t("Delete Photo")}
                            >
                                <X size={12} />
                            </button>
                            {v.photos.length > 1 && (
                                <>
                                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                                        {(currentPhotoIndex[v.id] || 0) + 1} / {v.photos.length}
                                    </div>
                                    <button 
                                        onClick={(e) => handlePrevPhoto(e, v.id, v.photos!.length)}
                                        className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors opacity-0 group-hover/photo:opacity-100"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                                    </button>
                                    <button 
                                        onClick={(e) => handleNextPhoto(e, v.id, v.photos!.length)}
                                        className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors opacity-0 group-hover/photo:opacity-100"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const lastFertDate = properties.find(p => p.id === v.propertyId)?.lastSolidFertilizerDate || client?.lastSolidFertilizerDate;
    const daysSinceFertilizer = lastFertDate ? Math.floor((Date.now() - new Date(lastFertDate).getTime()) / (1000 * 60 * 60 * 24)) : null;
    const showFertilizerBadge = daysSinceFertilizer !== null && daysSinceFertilizer >= 30;
    const fertilizerColor = daysSinceFertilizer !== null && daysSinceFertilizer >= 60 ? 'text-red-500 hover:bg-red-500/10' : 'text-green-500 hover:bg-green-500/10';

    return (
      <div 
        key={v.id} 
        className={`bg-bg-card border-black/5 dark:border-white/10 border rounded-2xl p-3 shadow-sm hover:shadow-md transition-all duration-200 group relative flex flex-col mb-4 break-inside-avoid h-auto
          ${isActive ? 'ring-2 ring-accent-color/20' : ''}`}
      >
        <div className="flex gap-4">
            {/* Left Section: Date/Day */}
            <div className="flex flex-col items-center justify-center w-14 bg-accent-color/5 dark:bg-white/5 rounded-xl border border-accent-color/10 p-2 shrink-0 h-fit">
                <span className="text-[11px] font-black text-accent-color uppercase tracking-tighter">
                    {isInvalidDate ? '???' : isToday ? t('Today').toUpperCase() : isTomorrow ? t('Tomorrow').toUpperCase() : format(visitDate, 'EEEEEE', { locale: currentLocale }).replace(/^./, c => c.toUpperCase())}
                </span>
                <span className="text-xl font-black text-main leading-none my-1">
                    {isInvalidDate ? '--' : format(visitDate, 'dd')}
                </span>
                <span className="text-[11px] font-bold text-text-secondary uppercase">
                    {isInvalidDate ? '???' : format(visitDate, 'MMM', { locale: currentLocale })}
                </span>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1 gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                        <h3 
                            onClick={() => onNavigate(Page.Details, v.clientId)}
                            className="text-sm font-black text-main truncate cursor-pointer hover:text-accent-color transition-colors leading-tight"
                        >
                            {client?.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : (client?.nume || v.clientName)}
                        </h3>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowHistoryModal({ clientId: v.clientId, clientName: (client?.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : (client?.nume || v.clientName)), propertyId: v.propertyId, propertyName: v.propertyAddress }); }}
                            className="p-1 text-text-secondary hover:text-accent-color transition-colors shrink-0 flex items-center gap-1"
                            title={t('Service History')}
                        >
                            <History size={12} />
                            {diffDays !== null && <span className="text-[11.5px] font-bold italic">[{diffDays}z]</span>}
                        </button>
                    </div>
                    <div className="flex gap-1">
                        <button 
                            onClick={(e) => handleEditClick(v, e)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-text-secondary hover:text-accent-color hover:bg-accent-color/10 transition-all"
                            title={t('Edit')}
                        >
                            <Edit2 size={14} strokeWidth={1.5} />
                        </button>
                        <button 
                            onClick={(e) => handleDeleteClick(v, e)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            title={t('Delete')}
                        >
                            <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-bold text-text-secondary mb-1">
                    <span>{maintenanceText}</span>
                    <span>•</span>
                    <span className="truncate">{employeeName}</span>
                </div>

                <div className="flex items-center gap-1.5 truncate">
                    <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary hover:text-blue-500 hover:underline truncate">
                        <MapPin size={12} className="text-accent-color flex-shrink-0" />
                        <span className="truncate">{displayAddress}</span>
                    </a>
                    {v.propertyId && properties.find(p => p.id === v.propertyId)?.irrigation && (
                        <Droplets 
                            size={12} 
                            className={isIrrigatingToday(properties.find(p => p.id === v.propertyId)!, visitDate) ? "text-blue-500 flex-shrink-0" : "text-gray-300 flex-shrink-0"} 
                        />
                    )}
                    {showFertilizerBadge && (
                        <button 
                          title={t('Zile de la ultima fertilizare - Istoric')} 
                          className={`flex shrink-0 items-center gap-1 p-1 rounded-md transition-colors ${fertilizerColor}`}
                          onClick={(e) => {
                              e.stopPropagation();
                              if (client) {
                                  setClientInfoModalData({ client, type: 'fertilizer' });
                              }
                          }}
                        >
                          <Sprout size={12} />
                          <span className="text-[11px] font-bold">{daysSinceFertilizer}z</span>
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Bottom Row: Actions + Weather */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2 ml-[64px]">
                {/* Reprogrammed indicator */}
                {isReprogrammed && (
                  <div 
                    className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1" 
                    title={originalDataFormatted ? `${t('Rescheduled from')} ${originalDataFormatted}` : t('Reprogrammed')}
                  >
                    <CalendarClock size={10} />
                    <span>{isMobile ? originalDataFormatted || t('Reprogrammed') : `${t('Reprogrammed')}${originalDataFormatted ? ` (${originalDataFormatted})` : ''}`}</span>
                  </div>
                )}

                {!isActive && (!(v as any).isLead || (v as any).leadData?.status === 'vizualizat') && (
                    <div className="flex items-center gap-0">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRescheduleToYesterday(v);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-text-secondary hover:text-blue-500 transition-all"
                            title={t('Previous day')}
                        >
                            <FastForward size={16} className="rotate-180" />
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRescheduleToTomorrow(v);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-text-secondary hover:text-blue-500 transition-all"
                            title={t('Next day')}
                        >
                            <FastForward size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">

                <div className="flex gap-1 ml-2">
                    <a href={`tel:${cleanPhone}`} className="w-8 h-8 flex items-center justify-center transition-all text-main hover:text-accent-color">
                        <Phone size={18} />
                    </a>
                    {cleanPhone && (
                        <a 
                            href={waLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-8 h-8 flex items-center justify-center transition-all text-[#25D366] hover:text-[#128C7E]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                            </svg>
                        </a>
                    )}
                </div>
            </div>
        </div>

        {/* Start Work Button: Bottom Left Tear Drop */}
        <button 
            onClick={(e) => {
                e.stopPropagation();
                if (!v.assignedTo || v.assignedTo === auth.currentUser?.uid) {
                    isActive ? handleOpenFinish(v) : handleStartWork(v);
                }
            }} 
            className={`absolute bottom-0 left-0 w-14 h-11 flex flex-col items-center justify-center rounded-tr-3xl rounded-bl-2xl text-[11px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95 z-20 ${
                isActive ? 'bg-red-500 text-white animate-pulse' : 'bg-accent-color text-white hover:bg-accent-color/90'
            }`}
        >
            {isActive ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            <span>{isActive ? "Fin" : "Start"}</span>
        </button>
      </div>
    );
  };

  return (
    <>
      {photoViewer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-in fade-in" onClick={() => setPhotoViewer(null)}>
            <img src={photoViewer} className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain" alt="Vizualizare poză" onClick={(e) => e.stopPropagation()} />
            <button onClick={() => setPhotoViewer(null)} className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
      )}
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <input 
          type="file" 
          ref={historyFileInputRef}
          onChange={handleArchivePhotoUpload}
          className="hidden"
          accept="image/*"
      />
      {/* ────── PREMIUM TERMINAL HEADER ────── */}
      <div className="flex flex-row items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent p-3 md:p-5 md:min-h-[104px] rounded-2xl border border-amber-500/10 mb-4 md:mb-6 animate-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3 md:gap-5 w-full">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/30 transform -rotate-3 hover:rotate-0 transition-transform duration-500 shrink-0">
            <CalendarIcon className="w-5 h-5 md:w-7 md:h-7" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.png" alt="Scapeflow" className="w-3 h-3 md:w-4 md:h-4 object-contain drop-shadow-sm" />
              <h2 className="text-[9px] md:text-[11px] font-black text-amber-500 uppercase tracking-[0.4em] leading-none">Scapeflow</h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[8px] font-black uppercase tracking-tighter shadow-sm">{t('Intelligence Terminal')}</span>
            </div>
            <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                <h1 className="text-lg md:text-3xl font-black text-main uppercase tracking-tighter leading-none">
                  {userProfile?.accountType === 'PF' ? t('Activity History') : t('Schedule Stream')}
                </h1>
            </div>
            <p className="text-[9px] md:text-xs text-text-secondary font-bold uppercase tracking-[0.2em] opacity-60 hidden sm:block">
              {t('Command Center')}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 bg-bg-card/50 backdrop-blur-md border border-border-color px-4 py-2 rounded-2xl shadow-sm shrink-0">
            <div className="flex flex-col items-end">
                <span className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{t('Active Missions')}</span>
                <span className="text-sm font-mono font-black text-amber-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                  {stats.total} {t('Appointments_Short').toUpperCase()}
                </span>
            </div>
        </div>
      </div>
      
      {isPF && <AdBanner subscriptionTier={subscriptionTier} />}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex bg-bg-main border border-border-color rounded-xl p-1">
            <button 
              onClick={() => setListFilter('all')} 
              disabled={viewMode !== 'list'}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-border-color/50 last:border-0 transition-colors ${listFilter === 'all' ? 'bg-bg-card' : ''} ${viewMode !== 'list' ? 'opacity-50 cursor-not-allowed' : ''}`} 
              title={t('All')}
            >
              <Hash size={14} className="text-text-secondary" />
              <span className="text-xs font-bold text-main">{stats.total}</span>
            </button>
            <button 
              onClick={() => setListFilter('azi')} 
              disabled={viewMode !== 'list'}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-border-color/50 last:border-0 transition-colors ${listFilter === 'azi' ? 'bg-bg-card' : ''} ${viewMode !== 'list' ? 'opacity-50 cursor-not-allowed' : ''}`} 
              title={t('Today')}
            >
              <Play size={14} className="text-accent-color" />
              <span className="text-xs font-bold text-main">{stats.active}</span>
            </button>
            <button 
              onClick={() => setListFilter('viitor')} 
              disabled={viewMode !== 'list'}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-border-color/50 last:border-0 transition-colors ${listFilter === 'viitor' ? 'bg-bg-card' : ''} ${viewMode !== 'list' ? 'opacity-50 cursor-not-allowed' : ''}`} 
              title={t('Future')}
            >
              <CalendarIcon size={14} className="text-blue-500" />
              <span className="text-xs font-bold text-main">{stats.scheduled}</span>
            </button>
            <button 
              onClick={() => setListFilter('arhiva')} 
              disabled={viewMode !== 'list'}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-border-color/50 last:border-0 transition-colors ${listFilter === 'arhiva' ? 'bg-bg-card' : ''} ${viewMode !== 'list' ? 'opacity-50 cursor-not-allowed' : ''}`} 
              title={t('Archive')}
            >
              <CheckCircle2 size={14} className="text-green-500" />
              <span className="text-xs font-bold text-main">{stats.archived}</span>
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-bg-main border border-border-color rounded-xl p-1">
            {(isMobile ? activeViewsMobile : activeViewsDesktop).includes('list') && (
              <button 
                onClick={() => handleViewModeChange('list')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-bg-card text-main shadow-sm' : 'text-text-secondary hover:text-main'}`}
              >
                <List size={16} className="inline-block mr-2" /> {t('List')}
              </button>
            )}
            {(isMobile ? activeViewsMobile : activeViewsDesktop).includes('agenda') && (
              <button 
                onClick={() => handleViewModeChange('agenda')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'agenda' ? 'bg-bg-card text-main shadow-sm' : 'text-text-secondary hover:text-main'}`}
              >
                <Clock size={16} className="inline-block mr-2" /> {t('Agenda')}
              </button>
            )}
            {isPF && (
                <button 
                    onClick={() => handleViewModeChange('guide')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'guide' ? 'bg-bg-card text-main shadow-sm' : 'text-text-secondary hover:text-main'}`}
                >
                    <Sprout size={16} className="inline-block mr-2" /> {t('Guide')}
                </button>
            )}
            {subscriptionTier !== 'free' && (
              <>
                {(isMobile ? activeViewsMobile : activeViewsDesktop).includes('kanban') && (
                  <button 
                    onClick={() => handleViewModeChange('kanban')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'kanban' ? 'bg-bg-card text-main shadow-sm' : 'text-text-secondary hover:text-main'}`}
                  >
                    <CalendarIcon size={16} className="inline-block mr-2" /> {t('Kanban')}
                  </button>
                )}
                {(isMobile ? activeViewsMobile : activeViewsDesktop).includes('route') && (
                  <button 
                    onClick={() => handleViewModeChange('route')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'route' ? 'bg-bg-card text-main shadow-sm' : 'text-text-secondary hover:text-main'}`}
                  >
                    <Map size={16} className="inline-block mr-2" /> {t('Route')}
                  </button>
                )}
              </>
            )}
          </div>
          <button onClick={() => {
            resetForm();
            setShowModal(true);
          }} className="bg-accent-color/10 text-accent-color border border-accent-color/20 p-2.5 rounded-xl hover:bg-accent-color/20 transition-all active:scale-95 flex items-center justify-center shadow-sm" title={t('New Appointment')}>
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* Removed filter switcher */}

      {!loading && visits.length === 0 && (
        <EmptyState 
          title={t('Empty Mission Stream')} 
          description={t('You have no scheduled missions yet. Start by adding a new appointment or restore old data.')} 
          type="no-data"
          action={
            <button onClick={handleSyncData} disabled={isMigrating} className="bg-accent-color text-white px-8 py-3 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-accent-color/20 hover:scale-[1.02] active:scale-95 transition-all">
               {isMigrating ? t('Processing...') : t('Restore Old Missions')}
            </button>
          }
        />
      )}

      {viewMode === 'guide' && isPF ? (
          <GuideView 
            selectedGuideMonth={selectedGuideMonth} 
            setSelectedGuideMonth={setSelectedGuideMonth} 
          />
      ) : viewMode === 'route' ? (
        <div id="schedule-content-anchor">
          <RoutePlanner 
            organizationId={organizationId} 
            userRole={userRole} 
            userId={auth.currentUser?.uid || ''} 
            onClientClick={(clientId, clientName, propertyId, propertyName) => setShowHistoryModal({ clientId, clientName, propertyId, propertyName })}
            onNavigate={onNavigate}
          />
        </div>
      ) : viewMode === 'list' ? (
        <ListView 
          listFilter={listFilter}
          grouped={grouped}
          renderCard={renderCard}
          handleMoveAllToTomorrow={handleMoveAllToTomorrow}
          archivePage={archivePage}
          setArchivePage={setArchivePage}
          ARCHIVE_PER_PAGE={ARCHIVE_PER_PAGE}
        />
      ) : viewMode === 'kanban' ? (
        <div id="schedule-content-anchor">
          <WeeklyKanban 
            visits={userRole === 'admin' ? visits : visits.filter(v => (v as any).isLead || v.assignedTo === auth.currentUser?.uid)} 
            properties={properties} 
            clients={clients}
            userProfile={userProfile}
            workDays={workDays}
            onNavigate={onNavigate}
            onClientClick={(clientId, clientName, propertyId, propertyName) => setShowHistoryModal({ clientId, clientName, propertyId, propertyName })}
            onFertilizerClick={(clientId, propertyId) => {
              const client = clients.find(c => c.id === clientId);
              if (client) setClientInfoModalData({ client, type: 'fertilizer', propertyId });
            }}
            onEditLead={() => {}}
            onDeleteLead={() => {}}
            onUpdateLeadStatus={async (leadId, status) => {
              try {
                await updateDoc(doc(db, 'leads', leadId), { status });
                logger.log(`Status lead actualizat: ${status}`, "info");
              } catch (err) {
                console.error("Error updating lead status:", err);
              }
            }}
            onUpdateLeadNote={async (leadId, note) => {
              try {
                await updateDoc(doc(db, 'leads', leadId), { notite: note });
              } catch (err) {
                console.error("Error updating lead note:", err);
              }
            }}
            onOpenLostReason={async (leadId) => {
              const lead = (leads || []).find(l => l.id === leadId);
              if (lead) {
                // Bug #6 fix: nu mai hardcoda motivul — cerem input de la utilizator
                const reason = prompt('Motivul pierderii lead-ului (ex: Preț mare, Concurență, Distanță):') || 'Nespecificat';
                await updateDoc(doc(db, 'leads', leadId), { status: 'pierdut', lostReason: reason });
              }
            }}
            onUpdateVisitDate={async (visitId, newDate) => {
              try {
                if (visitId.startsWith('lead_')) {
                  const realId = visitId.replace('lead_', '');
                  const lead = visits.find(v => v.id === visitId);
                  if (lead && (lead as any).isLead && (lead as any).leadData?.status !== 'vizualizat') {
                    logger.log("Doar lead-urile 'De contactat' pot fi reprogramate.", "warn");
                    return;
                  }
                  await updateDoc(doc(db, 'leads', realId), { nextActionDate: newDate, data: newDate });
                } else {
                  const currentVisit = visits.find(v => v.id === visitId);
                  await updateDoc(doc(db, 'visits', visitId), { 
                    data: newDate,
                    originalData: currentVisit?.originalData || currentVisit?.data || null
                  });
                }
              } catch (err) {
                console.error("Error updating visit date:", err);
              }
            }}
            onEditVisit={(visit) => {
              handleEditClick(visit);
            }}
          />
        </div>
      ) : viewMode === 'agenda' ? (
        <DailyAgendaView 
          agendaVisits={agendaVisits}
          visits={visits}
          clients={clients}
          properties={properties}
          workDays={workDays}
          currentLocale={currentLocale}
          userName={auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || t('User')}
          isMobile={isMobile}
          onNavigate={onNavigate}
          handleEditClick={handleEditClick}
          onFertilizerClick={(clientId, propertyId) => {
            const client = clients.find(c => c.id === clientId);
            if (client) setClientInfoModalData({ client, type: 'fertilizer', propertyId });
          }}
          handleStartWork={handleStartWork}
          handleOpenFinish={handleOpenFinish}
          setShowHistoryModal={setShowHistoryModal}
          organization={organization}
        />
      ) : (
        <div id="schedule-content-anchor" className="bg-bg-card rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
                <button 
                onClick={handlePrevWeek} 
                disabled={weekOffset <= -4}
                className={`p-2 rounded-full transition-colors ${weekOffset <= -4 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                title={t('Previous Week')}
                >
                <ChevronLeft size={24} className="text-text-secondary" />
                </button>
                <button 
                onClick={handleCurrentWeek}
                disabled={weekOffset === 0}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${weekOffset === 0 ? 'bg-accent-color text-white' : 'bg-black/5 text-text-secondary hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}
                >
                {t('Today')}
                </button>
            </div>
            <h2 className="text-xl font-bold text-main capitalize">
              {format(currentWeekStart, 'MMMM yyyy', { locale: currentLocale })}
            </h2>
            <button 
              onClick={handleNextWeek} 
              disabled={weekOffset >= 4}
              className={`p-2 rounded-full transition-colors ${weekOffset >= 4 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
              title={t('Next Week')}
            >
              <ChevronRight size={24} className="text-text-secondary" />
            </button>
          </div>
          
          <div className="flex flex-col gap-4">
            <AgendaView 
            days={eachDayOfInterval({
              start: currentWeekStart,
              end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
            }).filter(day => {
              const dayOfWeek = getDay(day);
              if (workDays === 'L-V') return dayOfWeek >= 1 && dayOfWeek <= 5;
              if (workDays === 'L-S') return dayOfWeek >= 1 && dayOfWeek <= 6;
              return true;
            })}
            visits={filteredVisits}
            clients={clients}
            currentLocale={currentLocale}
            onEditVisit={handleEditClick}
            onClientClick={(clientId, clientName, propertyId, propertyName) => setShowHistoryModal({ clientId, clientName, propertyId, propertyName })}
            organization={organization}
          />
</div>
        </div>
      )}

      {/* Modal adăugare rămâne la fel... */}
      <EditVisitModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        onSubmit={handleAddMission}
        isEditing={isEditing}
        editingVisitId={editingVisitId}
        formData={formData}
        setFormData={setFormData}
        properties={properties}
        clients={clients}
        visits={visits}
        employees={employees}
        userRole={userRole}
        accountType={accountType}
      />

      {showNoteModal && (
        <div className="fixed inset-0 z-[2010] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowNoteModal(null)}></div>
          <div className="stihl-card w-full max-w-sm rounded-lg p-6 relative bg-bg-card">
            <div className="mb-4">
               <h3 className="text-lg font-black text-main">{showNoteModal.type === 'view' ? t('Edit Note') : t('Add Note')}</h3>
               <p className="text-xs font-bold text-text-secondary truncate mt-0.5" title={`${showNoteModal.visit.clientName} ${showNoteModal.visit.propertyAddress ? `- ${showNoteModal.visit.propertyAddress}` : ''}`}>
                 {showNoteModal.visit.clientName} {showNoteModal.visit.propertyAddress ? `- ${showNoteModal.visit.propertyAddress}` : ''}
               </p>
            </div>
            <textarea 
              className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-medium outline-none focus:border-accent-color min-h-[100px] mb-6"
              placeholder={t("Add note...")}
              value={finishNote}
              onChange={(e) => setFinishNote(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNoteModal(null)} className="px-4 py-2 rounded-md text-xs font-bold uppercase bg-bg-main text-text-secondary">Închide</button>
              <button onClick={async () => {
                await updateDoc(doc(db, 'visits', showNoteModal.visit.id), { finishNote: finishNote || null });
                setShowNoteModal(null);
              }} className="px-4 py-2 rounded-md text-xs font-bold uppercase bg-accent-color text-white">{t('Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal finalizare rămâne la fel... */}
      {showFinishModal && selectedVisit && (
        <div className="fixed inset-0 z-[2010] flex items-center justify-center p-1 sm:p-2" onClick={(e) => {
            if (e.target === e.currentTarget) {
                (document.activeElement as HTMLElement)?.blur();
            }
        }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowFinishModal(false)}></div>
          <div className="stihl-card w-full max-w-lg rounded-lg p-2 sm:p-3 relative bg-bg-card max-h-[85vh] flex flex-col">
             <div className="flex justify-between items-start mb-1 sm:mb-2 flex-shrink-0">
                <div>
                   <h3 className="text-base font-black text-main">Raport Finalizare</h3>
                   <p className="text-[11px] font-bold text-text-secondary truncate max-w-[200px] sm:max-w-[250px]" title={`${selectedVisit.clientName} ${selectedVisit.propertyAddress ? `- ${selectedVisit.propertyAddress}` : ''}`}>
                     {selectedVisit.clientName} {selectedVisit.propertyAddress ? `- ${selectedVisit.propertyAddress}` : ''}
                   </p>
                </div>
                <div className="flex items-center gap-1">
                   {isProcessing && <Loader2 size={16} className="animate-spin text-accent-color" />}
                   <label className="p-1 rounded-xl bg-accent-color/10 text-accent-color hover:bg-accent-color/20 cursor-pointer transition-all border border-accent-color/20 shadow-sm" title={t('Add Photos')}>
                      <Camera size={16} />
                      <input 
                         type="file" 
                         accept="image/*" 
                         multiple 
                         className="hidden" 
                         onChange={(e) => handleFileUpload(e, visits.find(v => v.id === selectedVisit.id) || selectedVisit)} 
                      />
                   </label>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-1 sm:space-y-2" onClick={(e) => {
                 if (e.target === e.currentTarget) {
                    (document.activeElement as HTMLElement)?.blur();
                 }
             }}>
                {(() => {
                  const currentVisit = visits.find(v => v.id === selectedVisit.id) || selectedVisit;
                  return (
                    <>
                      {currentVisit.photos && currentVisit.photos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                          {currentVisit.photos.map((url, idx) => (
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
                            <span className="text-[11px] font-bold uppercase tracking-wider">Notițe Lucrare</span>
                         </div>
                         <textarea 
                            className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-medium outline-none focus:border-accent-color min-h-[60px] resize-none"
                            placeholder="Detalii lucrare sau observații..."
                            value={finishNote}
                            onChange={(e) => setFinishNote(e.target.value)}
                         />
                      </div>
                      
                      {selectedVisit.status === 'Finalizat' && (
                        <div className="space-y-1.5 border-t border-border-color/30 pt-2 mt-2">
                          <div className="flex items-center gap-2 text-text-secondary mb-1">
                              <CalendarIcon size={12} className="text-accent-color" />
                              <span className="text-[11px] font-bold uppercase tracking-wider">Modificare Dată/Oră Execuție</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-text-secondary mb-1">Dată</label>
                                <input type="date" value={editVisitDate} onChange={e => setEditVisitDate(e.target.value)} className="w-full bg-bg-main border border-border-color rounded-md px-2 py-1 text-sm outline-none focus:border-accent-color text-main" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-text-secondary mb-1">Oră Start</label>
                                <input type="time" value={editVisitStartTime} onChange={e => setEditVisitStartTime(e.target.value)} className="w-full bg-bg-main border border-border-color rounded-md px-2 py-1 text-sm outline-none focus:border-accent-color text-main" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-text-secondary mb-1">Oră Stop</label>
                                <input type="time" value={editVisitEndTime} onChange={e => setEditVisitEndTime(e.target.value)} className="w-full bg-bg-main border border-border-color rounded-md px-2 py-1 text-sm outline-none focus:border-accent-color text-main" />
                              </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {(() => {
                    const currentVisit = visits.find(v => v.id === selectedVisit.id) || selectedVisit;
                    const prop = properties.find(p => p.id === currentVisit.propertyId);
                    if (prop && prop.contractType === 'maintenance' && prop.maintenanceFrequency === 'occasional') {
                        return (
                          <div className="space-y-2 mt-2 p-3 bg-accent-color/5 border border-accent-color/20 rounded-lg">
                            <div className="flex items-center gap-2 text-accent-color mb-1">
                              <DollarSign size={12} />
                              <span className="text-[11px] font-bold uppercase tracking-wider">Facturare Ocazională</span>
                            </div>
                            <div className="flex gap-2">
                               <input 
                                  type="number" 
                                  className="w-full bg-bg-card border border-border-color rounded-md px-3 py-2 text-sm font-bold outline-none focus:border-accent-color"
                                  placeholder="Valoare intervenție (RON)"
                                  value={interventieCost}
                                  onChange={(e) => setInterventieCost(e.target.value)}
                               />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-2 text-xs font-medium text-main">
                               <input 
                                  type="checkbox" 
                                  className="w-4 h-4 accent-accent-color rounded"
                                  checked={interventieIncasata}
                                  onChange={(e) => setInterventieIncasata(e.target.checked)}
                               />
                               Suma a fost deja încasată (nu adăuga la sold)
                            </label>
                          </div>
                        );
                    }
                    return null;
                })()}

             {(() => {
                const sortedServices = [...serviceTypes].sort((a,b) => (a.order||0) - (b.order||0));
                const tunsService = serviceTypes.find(s => (s.name || '').toLowerCase().includes('tuns'));
                const primaryService = tunsService || (sortedServices.length > 0 ? sortedServices[0] : null);
                const primaryServiceName = primaryService ? primaryService.name : 'Serviciul Principal';

                const isMainServiceSelected = (Object.entries(selectedServices) as [string, {selected: boolean, quantity: string}][]).some(([id, val]) => {
                   if (!val.selected) return false;
                   return primaryService && id === primaryService.id;
                });
                
                if (!isMainServiceSelected && selectedVisit.status !== 'Finalizat') {
                    const fallbackDate = new Date();
                    fallbackDate.setDate(fallbackDate.getDate() + 7);
                    const fallbackDateStr = format(fallbackDate, 'yyyy-MM-dd');
                    const displayDateStr = nextScheduledDateStr || fallbackDateStr;
                    
                    return (
                        <div className="mb-4 p-3 bg-accent-color/5 border border-accent-color/20 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                           <div className="flex items-center gap-2 text-accent-color mb-1.5">
                              <CalendarIcon size={14} />
                              <span className="text-[11px] font-bold uppercase tracking-wider">Atenție: {primaryServiceName} lipsește</span>
                           </div>
                           <p className="text-[10px] text-text-secondary/80 font-medium mb-3 leading-relaxed">
                              Autoreprogramarea se face implicit doar dacă efectuezi și serviciul principal ({primaryServiceName}). Dacă dorești totuși să generezi o nouă programare, bifează mai jos.
                           </p>
                           <label className="flex items-center justify-between cursor-pointer group">
                              <span className="text-[11px] font-bold text-main group-hover:text-accent-color transition-colors">
                                 Reprogramează totuși pe {format(parseSafeDate(displayDateStr), 'dd.MM.yyyy')}
                              </span>
                              <div className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white cursor-pointer border border-border-color" style={{ backgroundColor: autoRescheduleOverride ? 'var(--accent-color)' : 'var(--bg-main)' }}>
                                  <input 
                                     type="checkbox"
                                     className="sr-only"
                                     checked={autoRescheduleOverride || false}
                                     onChange={(e) => setAutoRescheduleOverride(e.target.checked)}
                                  />
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${autoRescheduleOverride ? 'translate-x-4 shadow-sm' : 'translate-x-1 border border-border-color/50'}`} />
                              </div>
                           </label>
                        </div>
                    );
                }
                return null;
             })()}

                <div className="space-y-2">
                   <div className="flex items-center gap-2 text-text-secondary mb-1">
                      <List size={12} className="text-accent-color" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Servicii Efectuate</span>
                   </div>
                   <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar border border-border-color/10 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                      {serviceTypes.filter(st => st.isActive !== false).map(st => {
                        const currentVisit = visits.find(v => v.id === selectedVisit.id) || selectedVisit;
                        const client = clients.find(c => c.id === currentVisit.clientId);
                        let suprafata = client?.suprafataMp || 0;
                        let matchedProp = null;
                        if (currentVisit.propertyId) {
                          matchedProp = properties.find(p => p.id === currentVisit.propertyId);
                        }
                        if (!matchedProp && currentVisit.clientId) {
                          const addr = currentVisit.propertyAddress || currentVisit.clientAddress;
                          if (addr) {
                            const normAddr = normalizeAddress(addr);
                            matchedProp = properties.find(p => 
                              p.clientId === currentVisit.clientId && 
                              (normalizeAddress(p.address) === normAddr || normalizeAddress(p.name) === normAddr)
                            );
                          }
                        }
                        if (matchedProp && matchedProp.surfaceArea) {
                          suprafata = matchedProp.surfaceArea;
                        }
                        
                        const startTime = (currentVisit.currentSessionStart && currentVisit.currentSessionStart.toDate) ? currentVisit.currentSessionStart.toDate() : new Date();
                        const durationHours = ((new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(2);

                        return (
                          <div key={st.id} className={`flex items-center gap-2 px-2.5 py-1.5 min-h-[36px] rounded-lg border transition-all duration-200 ${selectedServices[st.id]?.selected ? 'bg-accent-color/10 border-accent-color/30 shadow-sm' : 'bg-bg-main border-border-color/50 hover:border-border-color hover:bg-black/5 dark:hover:bg-white/5'}`}>
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 accent-accent-color flex-shrink-0 cursor-pointer" 
                              checked={selectedServices[st.id]?.selected || false} 
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                let quantity = selectedServices[st.id]?.quantity || '';
                                
                                if (isChecked && !quantity) {
                                  const unit = (st.unit || '').toLowerCase();
                                  const name = (st.name || '').toLowerCase();
                                  if (name.includes('fertilizare') || name.includes('ingrasamant')) {
                                    quantity = ((suprafata * defaultFertilizerDosage) / 1000).toFixed(2);
                                  } else if (unit === 'm²' || unit === 'mp' || unit === 'm2') {
                                    quantity = suprafata.toString();
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
                            <p className="flex-1 text-[11px] font-bold uppercase text-main leading-tight truncate cursor-pointer" onClick={() => {
                                // Toggle on text click
                                const isChecked = !(selectedServices[st.id]?.selected || false);
                                let quantity = selectedServices[st.id]?.quantity || '';
                                if (isChecked && !quantity) {
                                  const unit = (st.unit || '').toLowerCase();
                                  const name = (st.name || '').toLowerCase();
                                  if (name.includes('fertilizare') || name.includes('ingrasamant')) {
                                    quantity = ((suprafata * defaultFertilizerDosage) / 1000).toFixed(2);
                                  } else if (unit === 'm²' || unit === 'mp' || unit === 'm2') {
                                    quantity = suprafata.toString();
                                  } else if (unit === 'ora' || unit === 'ore' || unit === 'h') {
                                    quantity = durationHours;
                                  }
                                }
                                setSelectedServices({...selectedServices, [st.id]: { ...selectedServices[st.id], selected: isChecked, quantity }});
                            }}>{st.name}</p>
                            {selectedServices[st.id]?.selected && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <input 
                                  type="number" 
                                  className="w-14 h-5 bg-bg-card border border-border-color px-1 rounded-sm text-[11px] font-bold m-0 outline-none text-center" 
                                  style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                                  value={selectedServices[st.id]?.quantity || ''} 
                                  onChange={(e) => setSelectedServices({...selectedServices, [st.id]: {...selectedServices[st.id], quantity: e.target.value}})} 
                                />
                                <span className="text-[8px] font-black text-text-secondary uppercase w-4">{st.unit}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                   </div>
                 </div>
              </div>

             <div className="flex flex-col gap-2 mt-4 flex-shrink-0 pb-2">
               <button 
                  onClick={handleFinalize}
                  disabled={isProcessing}
                  className="w-full stihl-button rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md py-3 flex items-center justify-center gap-2"
               >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  SALVEAZĂ RAPORTUL
               </button>

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
                                  if (selectedVisit.autoScheduledNextVisitId) {
                                      try {
                                          await deleteDoc(doc(db, 'visits', selectedVisit.autoScheduledNextVisitId));
                                      } catch (err) {
                                          console.error("Failed to delete auto-scheduled visit:", err);
                                      }
                                  }
                                  await updateDoc(doc(db, 'visits', selectedVisit.id), {
                                      status: 'Programat',
                                      currentSessionStart: null,
                                      nextVisitScheduled: false,
                                      autoScheduledNextVisitId: null
                                  });
                                  setShowFinishModal(false);
                              } catch (e: any) { alert(e.message); }
                          }
                      });
                  }}
                  disabled={isProcessing}
                  className="w-full border border-red-500/30 bg-red-500/10 text-red-500 rounded-md font-bold uppercase tracking-wider text-[10px] py-2.5 flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-colors"
               >
                  <XCircle size={14} /> Anulează pornirea (Din greșeală)
               </button>
             </div>
          </div>
        </div>
      )}
      {confirmationModal && (
        <div className="fixed inset-0 z-[2020] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setConfirmationModal(null)}></div>
          <div className="stihl-card w-full max-w-md bg-bg-card rounded-[2rem] p-6 relative animate-in zoom-in-95 duration-300 shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-border-color overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-color/10 rounded-bl-full -z-10 blur-3xl"></div>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-accent-color/10 rounded-full flex items-center justify-center text-accent-color mb-4 border border-accent-color/20">
                <CalendarIcon size={28} />
              </div>
              
              <h3 className="text-xl font-black text-main uppercase tracking-tight mb-2">{confirmationModal.title}</h3>
              <p className="text-sm font-medium text-text-secondary mb-6">{confirmationModal.message}</p>
            </div>
            
            {confirmationModal.requireMath && (
              <div className="mb-6 p-4 bg-bg-main border border-border-color rounded-xl relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-accent-color"></div>
                 <p className="text-[11px] font-black uppercase tracking-widest text-text-secondary mb-3 ml-2">Măsură de siguranță: Introduceți rezultatul</p>
                 <div className="flex items-center gap-3 ml-2">
                    <span className="text-2xl font-black text-main flex-1">{mathProblem.num1} + {mathProblem.num2} = </span>
                    <input 
                      type="number" 
                      className="w-24 bg-bg-card border-2 border-border-color rounded-lg px-4 py-2 text-xl font-black text-center text-main outline-none focus:border-accent-color transition-colors"
                      value={mathProblem.answer}
                      onChange={(e) => setMathProblem(p => ({...p, answer: e.target.value}))}
                    />
                 </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmationModal(null)} 
                className="flex-1 px-4 py-3 bg-bg-main border border-border-color rounded-xl text-xs font-black uppercase tracking-widest text-text-secondary hover:text-main hover:border-accent-color/50 transition-all"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={async () => {
                  if (confirmationModal.onConfirm) await confirmationModal.onConfirm();
                  setConfirmationModal(null);
                }} 
                disabled={confirmationModal.requireMath ? parseInt(mathProblem.answer) !== (mathProblem.num1 + mathProblem.num2) : false}
                className={`flex-1 px-4 py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all ${
                  (confirmationModal.requireMath && parseInt(mathProblem.answer) !== (mathProblem.num1 + mathProblem.num2))
                    ? 'bg-text-secondary/50 shadow-none cursor-not-allowed'
                    : 'bg-accent-color shadow-accent-color/20 hover:bg-accent-color/90 active:scale-95'
                }`}
              >
                Confirmă
              </button>
            </div>
          </div>
        </div>
      )}

      <EditLeadModal 
        isOpen={showEditLeadModal} 
        onClose={() => setShowEditLeadModal(false)} 
        lead={selectedLead} 
        workDays={workDays}
      />

      <NewLeadModal 
        isOpen={showNewLeadModal} 
        onClose={() => setShowNewLeadModal(false)} 
        organizationId={organizationId} 
        workDays={workDays}
      />

      {showHistoryModal && (
        <ClientHistoryModal 
          clientId={showHistoryModal.clientId}
          clientName={showHistoryModal.clientName}
          visits={visits}
          onClose={() => setShowHistoryModal(null)}
          onViewProfile={(clientId) => onNavigate(Page.Details, clientId)}
          propertyId={showHistoryModal.propertyId}
          propertyName={showHistoryModal.propertyName}
          allProperties={properties}
        />
      )}

      {clientInfoModalData && (
        <ClientInfoModal
          isOpen={true}
          onClose={() => setClientInfoModalData(null)}
          client={clientInfoModalData.client}
          type={clientInfoModalData.type}
          visits={[]}
          properties={properties}
          organizationId={organizationId}
          fetchVisits={true}
          defaultPropertyId={clientInfoModalData.propertyId}
        />
      )}
    </div>
    </>
  );
};

export default Schedule;
