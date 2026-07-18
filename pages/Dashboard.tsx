

import { ActivityHeatmap } from '../components/dashboard/ActivityHeatmap';
import { GardenGallery } from '../components/dashboard/GardenGallery';
import { MonthlyForecastWidget } from '../components/dashboard/MonthlyForecastWidget';
import { TopClientsWidget } from '../components/dashboard/TopClientsWidget';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { auth, db, collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, Timestamp, setDoc, orderBy, limit, writeBatch } from '../services/firebase';
import { Visit, Page, Client, WorkSession, Product, Property, GardenTask } from '../src/types';
import Weather from '../components/Weather';
import { logger } from '../services/logger';
import { Bell, Calendar, TrendingUp, LayoutDashboard, History, ClipboardList, CheckCircle2, Clock4, MapPin, User, Sun, CalendarIcon, Check, Sprout, Square, Zap, Droplets, CloudRain, Image, BarChart2, Star } from 'lucide-react';
import { getMapsUrl } from '../utils/maps';
import Timer from '../components/Timer';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import { format, addDays, subDays, isSameDay, isAfter, isBefore, parseISO, startOfDay, startOfWeek, differenceInDays, getMonth, isSameMonth } from 'date-fns';
import { ro, enUS } from 'date-fns/locale';
import { monthlyGuide } from '../src/data/monthlyGuide';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { useData } from '../src/context/DataContext';
import { PageSkeleton, Skeleton } from '../components/ui/Skeleton';
import { DashboardStats } from '../components/DashboardStats';
import InteractiveMap from '../components/administration/InteractiveMap';
import { MisiunePrioritaraSkeleton, EchipeTerenSkeleton } from '../components/DashboardSkeletons';
import { getClientDisplayName, formatVisitDate } from '../utils/dashboardUtils';
import { parseSafeDate, calculateDaysSinceLastVisit, calculateDaysSinceVisitCompleted } from '../utils/date';
import { isDebtor } from '../utils/clientUtils';
import { getWhatsAppLink } from '../utils/phone';
import OnboardingWizard from '../components/OnboardingWizard';
import { usePlan } from '../src/hooks/usePlan';
import { AdBanner } from '../src/components/AdBanner';
import { PaymentModal } from '../components/PaymentModal';
import { Wallet, HandCoins } from 'lucide-react';

const parseSafeTimestamp = (ts: any): Date | null => {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts instanceof Date) return ts;
  if (ts.seconds) return new Date(ts.seconds * 1000);
  const parsed = new Date(ts);
  return isNaN(parsed.getTime()) ? null : parsed;
};

interface Props {
  onNavigate: (page: Page, id?: string) => void;
  organizationId: string;
  userRole: string;
  accountType?: 'PF' | 'PJ';
  userProfile?: any;
  activeVisit?: Visit | null;
  onStopWork?: () => void;
}

const Dashboard: React.FC<Props> = ({ onNavigate, organizationId, userRole, accountType = 'PJ' as 'PF' | 'PJ', userProfile, activeVisit, onStopWork }) => {
  const { visits, clients, properties, organization, products, loading } = useData();
  const isPF = accountType === 'PF';
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === 'ro' ? ro : enUS;


  const [defaultFertilizerDosage, setDefaultFertilizerDosage] = useState<number>(30);
  const [workDays, setWorkDays] = useState<'L-V' | 'L-S' | 'L-D'>('L-S');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [isBadPayer] = useState(false);
  const [showDebtorModal, setShowDebtorModal] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<Client | null>(null);
  const [showAllWithBalance, setShowAllWithBalance] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{isOpen: boolean, client: Client | null, amount: string}>({isOpen: false, client: null, amount: ''});

  // Data provided by Global DataContext

  const augmentedClients = useMemo(() => {
    return (clients || []).map(client => {
      const clientProps = (properties || []).filter(p => p.clientId === client.id);
      if (clientProps.length === 0) return {
        ...client,
        sold: client.sold || 0,
        tarifLunar: client.tarifLunar || 0,
      };

      let totalSold = 0;
      let totalTarif = 0;
      let contractType = client.contractType;
      let ziScadenta = client.ziScadenta;
      let dataScadenta = client.dataScadenta;
      let maintenanceFrequency = client.maintenanceFrequency;

      const hasMaintenance = clientProps.some(p => p.contractType === 'maintenance');
      if (hasMaintenance) {
        contractType = 'maintenance';
      } else if (clientProps.length > 0 && clientProps[0].contractType) {
        contractType = clientProps[0].contractType;
      }

      let maintenanceValue = 0;
      let oneTimeValue = 0;

      clientProps.forEach(p => {
        totalSold += (p.sold || 0);
        if (p.contractType === 'maintenance') {
          maintenanceValue += (p.tarifLunar || 0);
        } else {
          oneTimeValue += (p.tarifLunar || 0);
        }
        
        if ((p.sold || 0) > 0 && p.ziScadenta && (!ziScadenta || p.ziScadenta < ziScadenta)) {
          ziScadenta = p.ziScadenta;
        }
        if (p.dataScadenta) {
          dataScadenta = p.dataScadenta;
        }
        if (p.maintenanceFrequency) {
          maintenanceFrequency = p.maintenanceFrequency;
        }
      });

      return {
        ...client,
        sold: totalSold,
        tarifLunar: maintenanceValue + oneTimeValue, // for backward compatibility in other widgets
        maintenanceValue,
        oneTimeValue,
        contractType,
        ziScadenta,
        dataScadenta,
        maintenanceFrequency
      };
    });
  }, [clients, properties]);





  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [orgAddress, setOrgAddress] = useState<string | null>(null);
  const [orgLocalitate, setOrgLocalitate] = useState<string | null>(null);
  const [orgJudet, setOrgJudet] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState(8);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Corecție automată pentru vizitele legacy fără propertyId în Firestore (se execută doar pentru rolul 'admin')
  useEffect(() => {
    if (loading || !visits || !clients || !properties || userRole !== 'admin') return;

    const legacyVisits = visits.filter(v => !v.propertyId && v.clientId);
    if (legacyVisits.length === 0) return;

    const runAutoMigration = async () => {
      console.log(`[Migration] S-au găsit ${legacyVisits.length} vizite vechi fără propertyId. Corectare automată în curs...`);
      const batch = writeBatch(db);
      let count = 0;

      for (const visit of legacyVisits) {
        const clientProps = properties.filter(p => p.clientId === visit.clientId);
        if (clientProps.length === 0) continue;

        // Locație principală sau prima locație a clientului
        const defaultProp = clientProps.find(p => p.name === 'Locație Principală' || p.name === 'Main Location') || clientProps[0];
        if (defaultProp) {
          const visitRef = doc(db, 'visits', visit.id);
          batch.update(visitRef, {
            propertyId: defaultProp.id,
            propertyAddress: visit.propertyAddress || defaultProp.address || ''
          });
          count++;
        }
      }

      if (count > 0) {
        try {
          await batch.commit();
          console.log(`[Migration] S-au corectat automat ${count} vizite legacy în Firestore.`);
        } catch (err) {
          console.error("[Migration] Eroare la salvarea lotului de corecții în Firestore:", err);
        }
      }
    };

    runAutoMigration();
  }, [loading, visits, clients, properties, userRole]);

  useEffect(() => {
    if (window.innerWidth < 768 && !loading) {
      const element = document.getElementById('dashboard-content-anchor');
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [loading]);

  useEffect(() => {
     const updateBattery = () => {
       const now = new Date();
       const currentMinutes = now.getHours() * 60 + now.getMinutes();
       const [sH, sM] = startTime.split(':').map(Number);
       const [eH, eM] = endTime.split(':').map(Number);
       const startMins = sH * 60 + (sM || 0);
       const endMins = eH * 60 + (eM || 0);
       
       if (currentMinutes <= startMins) { setBatteryLevel(8); return; }
       if (currentMinutes >= endMins) { setBatteryLevel(0); return; }
       
       const totalMins = endMins - startMins;
       const passedMins = currentMinutes - startMins;
       const remainingRatio = 1 - (passedMins / totalMins);
       
       setBatteryLevel(Math.round(remainingRatio * 8));
     };
     
     updateBattery();
     const interval = setInterval(updateBattery, 60000);
     return () => clearInterval(interval);
  }, [startTime, endTime]);

  const nextVisit = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const availableDates = [...new Set((visits || [])
      .filter(v => v.status === 'Programat' && v.data >= today)
      .map(v => v.data))]
      .sort();
    
    if (availableDates.length === 0) return null;
    
    const targetDate = availableDates[0];
    const candidateVisits = visits.filter(v => v.data === targetDate && v.status === 'Programat');

    if (userLocation) {
      const sortedByDistance = [...candidateVisits].sort((a, b) => {
        const distA = (a.latitude && a.longitude) ? getDistance(userLocation.lat, userLocation.lon, a.latitude, a.longitude) : 999999;
        const distB = (b.latitude && b.longitude) ? getDistance(userLocation.lat, userLocation.lon, b.latitude, b.longitude) : 999999;
        return distA - distB;
      });
      return sortedByDistance[0];
    }

    return candidateVisits.sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''))[0];
  }, [visits, userLocation]);

  const upcomingVisits = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (visits || [])
      .filter(v => v.status === 'Programat' && v.data >= today)
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [visits]);

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const clientCounts = useMemo(() => {
    const active = augmentedClients.filter(c => c.status === 'Activ').length;
    const maintenance = augmentedClients.filter(c => c.contractType === 'maintenance').length;
    return { active, maintenance };
  }, [augmentedClients]);

  const maintenanceStats = useMemo(() => {
    const activeClients = (clients || []).filter(c => c.status === 'Activ');
    
    let totalSurface = 0;
    activeClients.forEach(client => {
      const clientProps = properties.filter(p => p.clientId === client.id);
      
      const maintenanceProps = clientProps.filter(p => {
        const pType = (p.contractType || '').toLowerCase();
        return pType === 'maintenance' || pType.includes('mentenanț') || pType.includes('mentenant') || !pType;
      });

      if (maintenanceProps.length > 0) {
        // Sum the surface areas of all maintenance properties safely
        totalSurface += maintenanceProps.reduce((sum, p) => sum + (Number(p.surfaceArea) || Number(p.suprafataMp) || 0), 0);
      } else if (clientProps.length === 0) {
        // If no properties exist, use client level surface if they are a maintenance client
        const cType = (client.contractType || '').toLowerCase();
        const isMaintenance = !cType || cType === 'maintenance' || cType.includes('mentenanț') || cType.includes('mentenant');
        if (isMaintenance) {
          totalSurface += (Number(client.suprafataMp) || Number(client.areaSqm) || 0);
        }
      }
    });

    const requiredFertilizer = (totalSurface * defaultFertilizerDosage) / 1000;

    return {
      totalSurface,
      requiredFertilizer: requiredFertilizer.toFixed(1)
    };
  }, [clients, properties, defaultFertilizerDosage]);

  const operationalProgress = useMemo(() => {
    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const startMins = sH * 60 + (sM || 0);
    const endMins = eH * 60 + (eM || 0);
    
    if (currentMinutes <= startMins) return 0;
    if (currentMinutes >= endMins) return 100;
    
    const totalMins = endMins - startMins;
    const passedMins = currentMinutes - startMins;
    return Math.min(100, Math.round((passedMins / totalMins) * 100));
  }, [currentTime, startTime, endTime]);

  const activeMissions = useMemo(() => (visits || []).filter(v => v.status === 'Activ'), [visits]);
  
  const todayVisits = useMemo(() => {
    const today = startOfDay(new Date());
    return (visits || [])
      .filter(v => {
        const d = v.data ? parseSafeDate(v.data) : null;
        return d && isSameDay(d, today);
      })
      .sort((a, b) => (a.oraProgramare || '00:00').localeCompare(b.oraProgramare || '00:00'));
  }, [visits]);

  const grouped = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const todayStr = format(today, 'yyyy-MM-dd');
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
    
    const res: { [key: string]: Visit[] } = {
      'Today': [],
      'Tomorrow': [],
      'Upcoming': []
    };

    (visits || []).filter(v => v.status !== 'Anulat' && v.status !== 'Finalizat').forEach(v => {
      let d: Date | null = null;
      
      // Strict matching to stay in sync with Agenda
      if (v.data) {
        if (v.data === todayStr) d = today;
        else if (v.data === tomorrowStr) d = tomorrow;
        else {
           // If it doesn't match the standard format, we try to parse it but only if it's really today
           const parsed = parseSafeDate(v.data);
           if (parsed && isSameDay(parsed, today)) d = today;
           else if (parsed && isSameDay(parsed, tomorrow)) d = tomorrow;
           else if (parsed && isAfter(parsed, tomorrow)) d = parsed;
        }
      }
      if (!d) return;
      
      if (isSameDay(d, today)) res['Today'].push(v);
      else if (isSameDay(d, tomorrow)) res['Tomorrow'].push(v);
      else if (isAfter(d, tomorrow)) res['Upcoming'].push(v);
    });

    Object.keys(res).forEach(k => {
      res[k].sort((a, b) => (a.oraProgramare || '00:00').localeCompare(b.oraProgramare || '00:00'));
    });

    return res;
  }, [visits]);

  const visitStats = useMemo(() => {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const tomorrow = addDays(startOfToday, 1);
    const todayStr = format(startOfToday, 'yyyy-MM-dd');
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
    
    const getTargetDate = (v: Visit) => {
      if (v.data) {
        if (v.data === todayStr) return startOfToday;
        if (v.data === tomorrowStr) return tomorrow;
        return parseSafeDate(v.data);
      }
      return null;
    };

    const todayVisits = (visits || []).filter(v => {
      const d = getTargetDate(v);
      return d && isSameDay(d, today) && v.status !== 'Anulat';
    });

    const tomorrowVisits = (visits || []).filter(v => {
      const d = getTargetDate(v);
      return d && isSameDay(d, tomorrow) && v.status !== 'Anulat';
    });

    return {
      today: todayVisits.filter(v => v.status === 'Programat' || v.status === 'Activ').length,
      tomorrow: tomorrowVisits.filter(v => v.status === 'Programat' || v.status === 'Activ').length,
      thisYear: (visits || []).filter(v => {
        const d = getTargetDate(v);
        return d && d.getFullYear() === today.getFullYear();
      }).length,
      totalThisMonth: (visits || []).filter(v => {
        const d = getTargetDate(v);
        return d && isSameMonth(d, today) && v.status !== 'Anulat';
      }).length,
      completedThisMonth: (visits || []).filter(v => {
        const d = getTargetDate(v);
        return d && isSameMonth(d, today) && v.status === 'Finalizat';
      }).length
    };
  }, [visits]);

  const operationalTimeline = useMemo(() => {
    const isWorkDay = (date: Date) => {
      const dow = date.getDay();
      if (workDays === 'L-V' && (dow === 0 || dow === 6)) return false;
      if (workDays === 'L-S' && dow === 0) return false;
      return true;
    };

    const pastDays: Date[] = [];
    let dPast = subDays(new Date(), 1);
    while (pastDays.length < 6) {
      if (isWorkDay(dPast)) pastDays.unshift(new Date(dPast));
      dPast = subDays(dPast, 1);
    }

    const futureDays: Date[] = [];
    let dFuture = new Date();
    while (futureDays.length < 7) {
      if (isWorkDay(dFuture)) futureDays.push(new Date(dFuture));
      dFuture = addDays(dFuture, 1);
    }

    const allDays = [...pastDays, ...futureDays];
    return allDays.map(day => {
      const dayVisits = (visits || []).filter(v => {
        if (v.status === 'Anulat') return false;
        const vDateStr = (v.status === 'Finalizat' && v.completedAt) 
          ? (() => {
              const cat = parseSafeTimestamp(v.completedAt);
              return cat ? format(cat, 'yyyy-MM-dd') : v.data;
            })()
          : v.data;
        if (vDateStr !== format(day, 'yyyy-MM-dd')) return false;
        const type = (v.tipLucrare || '').toLowerCase();
        const isMaintenance = !type || type.includes('mentenanț') || type.includes('mentenant') || type.includes('maintenance');
        if (!isMaintenance) return false;
        return v.status === 'Programat' || v.status === 'Finalizat' || v.status === 'Activ' || v.status === 'active';
      });

      return {
        date: day,
        isToday: isSameDay(day, new Date()),
        isPast: isBefore(day, startOfDay(new Date())),
        visits: dayVisits,
        completedCount: dayVisits.filter(v => v.status === 'Finalizat').length,
        remainingCount: dayVisits.filter(v => v.status !== 'Finalizat').length
      };
    });
  }, [visits, workDays]);

  const debtors = useMemo(() => augmentedClients.filter(c => isDebtor(c, true)), [augmentedClients]);
  const totalOutstanding = useMemo(() => augmentedClients.reduce((acc, c) => acc + (c.sold || 0), 0), [augmentedClients]);
  const totalMonthlyRate = useMemo(() => augmentedClients.reduce((acc, c) => acc + (c.tarifLunar || 0), 0), [augmentedClients]);
  const collectionRate = useMemo(() => totalMonthlyRate > 0 ? Math.max(0, Math.min(100, Math.round(((totalMonthlyRate - totalOutstanding) / totalMonthlyRate) * 100))) : 0, [totalMonthlyRate, totalOutstanding]);
  const visitRate = useMemo(() => visitStats.totalThisMonth > 0 ? Math.round((visitStats.completedThisMonth / visitStats.totalThisMonth) * 100) : 0, [visitStats]);
  
  const thisWeekStats = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    const weekVisits = (visits || []).filter(v => {
      const d = v.data ? parseSafeDate(v.data) : null;
      return d && d >= start && d <= end;
    });
    const total = weekVisits.length;
    const done = weekVisits.filter(v => v.status === 'Finalizat').length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, rate };
  }, [visits]);

  const topDebtors = useMemo(() => [...augmentedClients].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 5), [augmentedClients]);
  const lowStockProducts = useMemo(() => products.filter(p => p.stock <= (p.minStock || 10)), [products]);

  const historyQuery = useMemo(() => organizationId ? query(collection(db, 'client_history'), where('organizationId', '==', organizationId), where('type', '==', 'payment')) : null, [organizationId]);
  const { data: paymentHistory = [] } = useFirestoreQuery<any>(historyQuery, { pageSize: 0 });

  const invoicesQuery = useMemo(() => organizationId ? query(collection(db, 'invoices'), where('organizationId', '==', organizationId), where('status', 'in', ['unpaid', 'partially_paid'])) : null, [organizationId]);
  const { data: unpaidInvoices = [] } = useFirestoreQuery<any>(invoicesQuery, { pageSize: 0 });

  const financialTotals = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let collectedMaintenanceThisMonth = 0;
    let collectedUniqueThisMonth = 0;

    (paymentHistory || []).forEach((p: any) => {
      if (!p.date) return;
      const pDate = p.date.toDate ? p.date.toDate() : parseSafeDate(p.date);
      if (!pDate) return;

      if (pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
        const client = augmentedClients.find(c => c.id === p.clientId);
        const isMaintenance = client ? client.contractType === 'maintenance' : true;
        
        if (isMaintenance) {
          collectedMaintenanceThisMonth += (p.amount || 0);
        } else {
          collectedUniqueThisMonth += (p.amount || 0);
        }
      }
    });

    let outstandingMaintenance = 0;
    let outstandingUnique = 0;

    augmentedClients.forEach(c => {
      const soldVal = c.sold || 0;
      if (soldVal > 0) {
        if (c.contractType === 'maintenance') {
          outstandingMaintenance += soldVal;
        } else {
          outstandingUnique += soldVal;
        }
      }
    });

    const breakdownMaintenance: Record<string, number> = {};
    const breakdownUnique: Record<string, number> = {};

    const monthNamesRo = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

    const monthOrder = monthNamesRo.reduce((acc, month, idx) => {
      acc[month] = idx;
      return acc;
    }, {} as Record<string, number>);
    monthOrder['Istoric'] = -1;

    (unpaidInvoices || []).forEach((inv: any) => {
      const amt = inv.remainingAmount || 0;
      if (amt <= 0) return;
      const client = augmentedClients.find(c => c.id === inv.clientId);
      if (!client) return;

      let monthStr = 'Istoric';
      if (inv.billingMonth && inv.billingMonth !== 'Istoric') {
        const [y, m] = inv.billingMonth.split('-');
        if (m) {
          const monthIdx = parseInt(m, 10) - 1;
          if (monthIdx >= 0 && monthIdx < 12) {
            monthStr = monthNamesRo[monthIdx];
          }
        }
      }

      if (client.contractType === 'maintenance') {
        breakdownMaintenance[monthStr] = (breakdownMaintenance[monthStr] || 0) + amt;
      } else {
        breakdownUnique[monthStr] = (breakdownUnique[monthStr] || 0) + amt;
      }
    });

    const formatBreakdown = (breakdown: Record<string, number>) => {
      const entries = Object.entries(breakdown).filter(([_, val]) => val > 0);
      if (entries.length === 0) return '';
      entries.sort((a, b) => {
        const aOrder = monthOrder[a[0]] ?? -2;
        const bOrder = monthOrder[b[0]] ?? -2;
        return bOrder - aOrder;
      });
      return entries.map(([m, val]) => `${m} ${val.toLocaleString()} RON`).join(' , ');
    };

    return {
      collectedMaintenanceThisMonth,
      collectedUniqueThisMonth,
      outstandingMaintenance,
      outstandingUnique,
      breakdownMaintenanceStr: formatBreakdown(breakdownMaintenance),
      breakdownUniqueStr: formatBreakdown(breakdownUnique)
    };
  }, [paymentHistory, augmentedClients, unpaidInvoices]);

  const recentVisits = useMemo(() => {
     return [...(visits || [])]
       .filter(v => v.status === 'Finalizat')
       .sort((a, b) => {
          const aTime = a.completedAt?.toMillis ? a.completedAt.toMillis() : new Date(a.data).getTime();
          const bTime = b.completedAt?.toMillis ? b.completedAt.toMillis() : new Date(b.data).getTime();
          return bTime - aTime;
       })
       .slice(0, 10);
  }, [visits]);
  
  const gardenRecommendations = useMemo(() => {
    if (accountType !== 'PF') return [];
    
    const recs = [];
    const now = new Date();
    
    // 1. Lawn Mowing Recommendation (Every 7 days)
    const lastMow = recentVisits.find(v => v.tipLucrare?.toLowerCase().includes('tuns') || v.tipLucrare?.toLowerCase().includes('mow'));
    if (lastMow) {
      const lastDate = lastMow.completedAt?.toDate ? lastMow.completedAt.toDate() : parseSafeDate(lastMow.data);
      const daysSince = lastDate ? differenceInDays(now, lastDate) : 99;
      if (daysSince >= 7) {
        recs.push({
          id: 'mow',
          title: t('Time to mow the lawn'),
          description: t('It has been {{days}} days since your last mow. Keeping it trimmed helps healthy growth.', { days: daysSince }),
          priority: 'high',
          icon: 'Sprout'
        });
      }
    } else {
        recs.push({
          id: 'mow-initial',
          title: t('Schedule first mow'),
          description: t('No mowing activity recorded yet. Start your garden care by trimming the grass.'),
          priority: 'medium',
          icon: 'Sprout'
        });
    }

    // 2. Fertilizer Recommendation (Every 60 days)
    const lastFert = recentVisits.find(v => v.tipLucrare?.toLowerCase().includes('ingrasamant') || v.tipLucrare?.toLowerCase().includes('fertilizer'));
    if (lastFert) {
      const lastDate = lastFert.completedAt?.toDate ? lastFert.completedAt.toDate() : parseSafeDate(lastFert.data);
      const daysSince = lastDate ? differenceInDays(now, lastDate) : 99;
      if (daysSince >= 60) {
        recs.push({
          id: 'fert',
          title: t('Apply Fertilizer'),
          description: t('Your garden needs nutrients. Last application was {{days}} days ago.', { days: daysSince }),
          priority: 'medium',
          icon: 'Droplets'
        });
      }
    } else {
         recs.push({
          id: 'fert-initial',
          title: t('Seasonal Fertilization'),
          description: t('Plan your first fertilization to ensure deep roots and vibrant colors.'),
          priority: 'low',
          icon: 'Droplets'
        });
    }

    // 3. Irrigation Check (Daily)
    recs.push({
        id: 'irrigation',
        title: t('Check Irrigation'),
        description: t('Ensure your watering system is adjusted for current weather conditions.'),
        priority: 'low',
        icon: 'CloudRain'
    });

    return recs;
  }, [accountType, recentVisits, t]);

  const tasksQuery = useMemo(() => isPF && organizationId ? query(
    collection(db, 'garden_tasks'),
    where('organizationId', '==', organizationId)
  ) : null, [organizationId, accountType]);
  const { data: gardenTasks } = useFirestoreQuery<GardenTask>(tasksQuery, { pageSize: 0 });

  const gardenScore = useMemo(() => {
    if (accountType !== 'PF') return 0;
    let score = 90; // Base score
    let penalties = 0;
    
    const now = new Date();
    const todayStart = startOfDay(now);
    
    (gardenTasks || []).forEach(task => {
      const dueDate = task.nextDue?.toDate ? task.nextDue.toDate() : parseSafeDate(task.nextDue);
      if (dueDate && isBefore(dueDate, todayStart)) {
        penalties += 10; // -10 points for each overdue task
      }
    });

    const recentBonus = recentVisits.length * 2; // +2 for recent tasks
    
    score = score - penalties + recentBonus;
    return Math.max(10, Math.min(100, score));
  }, [gardenTasks, recentVisits, accountType]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500';
    if (score >= 70) return 'text-amber-500';
    return 'text-red-500';
  };
  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 70) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const currentMonthGuide = useMemo(() => {
    const monthIndex = getMonth(new Date());
    return monthlyGuide.find(m => m.month === monthIndex);
  }, []);

  useEffect(() => {
    if (!organizationId) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => console.warn('Could not get user location for mission prioritization')
    );

    const unsubOrg = onSnapshot(doc(db, 'organizations', organizationId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setOrgAddress(data.address || null);
        setOrgLocalitate(data.localitate || null);
        setOrgJudet(data.judet || null);
        if (data.defaultFertilizerDosage) setDefaultFertilizerDosage(data.defaultFertilizerDosage);
        if (data.workDays) setWorkDays(data.workDays);
        if (data.startTime) setStartTime(data.startTime);
        if (data.endTime) setEndTime(data.endTime);
        if (userRole === 'admin' && data.onboardingCompleted !== true) {
          setShowOnboarding(true);
        }
      }
    }, (err) => {
      console.error("Error in organization settings listener:", err);
    });

    return () => {
      unsubOrg();
    };
  }, [organizationId]);


  const sendWhatsApp = (client: Client) => {
    if (!client.telefon) {
        alert(t('Client no phone warning', { name: client.nume }));
        return;
    }
    const message = t('WhatsApp Debtor Message', { 
        sold: client.sold, 
        date: format(new Date(), 'dd.MM.yyyy'),
        userName: auth.currentUser?.displayName || 'Admin',
        companyName: orgAddress || 'Scapeflow',
        portalLink: `${window.location.origin}/#client-portal/${client.id}`
    });
    const phone = client.telefon.replace(/\D/g, '');
    if (phone.length < 9) {
        alert(t('Invalid phone warning', { phone: client.telefon }));
        return;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };



  const handleStopAll = async () => {
    if (!confirm(t('Are you sure stop all'))) return;
    try {
      for (const v of activeMissions) {
        const startTime = parseSafeTimestamp(v.currentSessionStart) || new Date();
        const now = new Date();
        const duration = Math.round((now.getTime() - startTime.getTime()) / 60000);
        await updateDoc(doc(db, 'visits', v.id), {
          status: 'Programat',
          currentSessionStart: null,
          workSessions: [...(v.workSessions || []), { start: Timestamp.fromDate(startTime), end: Timestamp.fromDate(now), duration }]
        });
      }
      logger.log("STOP ALL executed.", "warn");
    } catch (error) {
      console.error("Error stopping all missions:", error);
      logger.log("Error stopping missions.", "error");
    }
  };
  // Weather Alerts & Reschedule Alerts query
  const { data: forecastData } = useQuery({
    queryKey: ['dashboard-weather-alerts', orgLocalitate],
    queryFn: async () => {
      const loc = orgLocalitate || 'Craiova';
      const apiKey = 'b1b15e88fa797225412429c1c50c122a1';
      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(loc + ', Romania')}&appid=${apiKey}&units=metric`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!orgLocalitate || true
  });

  const weatherAlerts = useMemo(() => {
    if (!forecastData || !forecastData.list || !visits) return [];
    
    const dayForecasts: Record<string, { maxPop: number; hasRain: boolean; dateObj: Date }> = {};
    
    forecastData.list.forEach((item: any) => {
      const date = parseISO(item.dt_txt);
      const dateStr = format(date, 'yyyy-MM-dd');
      const hour = date.getHours();
      
      if (hour >= 9 && hour <= 18) {
        const pop = item.pop ? Math.round(item.pop * 100) : 0;
        const iconId = item.weather?.[0]?.id || 800;
        const isRainy = (iconId >= 200 && iconId < 600) || pop >= 50;
        
        if (!dayForecasts[dateStr]) {
          dayForecasts[dateStr] = { maxPop: pop, hasRain: isRainy, dateObj: date };
        } else {
          dayForecasts[dateStr].maxPop = Math.max(dayForecasts[dateStr].maxPop, pop);
          if (isRainy) dayForecasts[dateStr].hasRain = true;
        }
      }
    });

    const alerts: { dateStr: string; formattedDate: string; count: number; pop: number }[] = [];
    const today = startOfDay(new Date());
    
    for (let i = 0; i < 3; i++) {
      const targetDate = addDays(today, i);
      const targetDateStr = format(targetDate, 'yyyy-MM-dd');
      
      const forecast = dayForecasts[targetDateStr];
      if (forecast && forecast.hasRain) {
        const dayVisits = (visits || []).filter(v => {
          return v.status === 'Programat' && v.data === targetDateStr;
        });
        
        if (dayVisits.length > 0) {
          alerts.push({
            dateStr: targetDateStr,
            formattedDate: format(targetDate, 'EEEE', { locale: currentLocale }),
            count: dayVisits.length,
            pop: forecast.maxPop
          });
        }
      }
    }
    
    return alerts;
  }, [forecastData, visits, currentLocale]);

  // Today's Field Activity Statistics calculation
  const todayActivityStats = useMemo(() => {
    const today = startOfDay(new Date());
    const dayVisits = (visits || []).filter(v => {
      const d = v.data ? parseSafeDate(v.data) : null;
      return d && isSameDay(d, today) && v.status !== 'Anulat';
    });
    
    const completed = dayVisits.filter(v => v.status === 'Finalizat').length;
    const active = dayVisits.filter(v => v.status === 'Activ').length;
    const scheduled = dayVisits.filter(v => v.status === 'Programat').length;
    const total = completed + active + scheduled;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, active, scheduled, total, rate };
  }, [visits]);

  // Latest Active Mission for Live Timer Widget
  const latestActiveMission = useMemo(() => {
    if (activeMissions.length === 0) return null;
    return activeMissions.reduce((latest, current) => {
      const latestTime = parseSafeTimestamp(latest.currentSessionStart)?.getTime() || 0;
      const currentTime = parseSafeTimestamp(current.currentSessionStart)?.getTime() || 0;
      return currentTime > latestTime ? current : latest;
    }, activeMissions[0]);
  }, [activeMissions]);
  if (loading) return <PageSkeleton />;

  return (
    <>
      {showOnboarding && <OnboardingWizard organizationId={organizationId} onComplete={() => setShowOnboarding(false)} />}
      {showDebtorModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDebtorModal(false)}></div>
          <div className="bg-bg-card border border-border-color rounded-xl p-6 shadow-2xl relative z-10 w-full max-w-lg animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-main mb-4">{t('Send WhatsApp Notifications')}</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
              {debtors.map(d => (
                <div key={d.id} className="flex justify-between items-center bg-bg-main p-3 rounded-lg border border-border-color gap-3">
                  <div className="flex-1">
                    <span className="font-bold text-main">{d.nume}</span>
                    <div className="text-xs font-bold text-red-500 mt-0.5">{d.sold} RON</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPaymentModal({ isOpen: true, client: d, amount: String(d.sold || 0) })}
                      className="p-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
                      title={t('Collect')}
                    >
                      <HandCoins size={18} />
                    </button>
                    <a 
                      href={getWhatsAppLink(d.telefon || '', t('WhatsApp Debtor Message', { 
                          sold: d.sold, 
                          date: format(new Date(), 'dd.MM.yyyy'),
                          userName: auth.currentUser?.displayName || 'Admin',
                          companyName: organization?.nume || 'Scapeflow',
                          portalLink: `${window.location.origin}/#client-portal/${d.id}`
                      }))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-[#25D366]/10 text-[#25D366] rounded-lg hover:bg-[#25D366]/20 transition-colors"
                      title={t('Send WhatsApp')}
                    >
                      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                         <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setShowDebtorModal(false)} className="px-4 py-2 rounded-lg font-bold text-text-secondary hover:bg-bg-main">{t('Close')}</button>
            </div>
          </div>
        </div>
      )}

      <PaymentModal
        isOpen={paymentModal.isOpen}
        client={paymentModal.client}
        initialAmount={paymentModal.amount}
        properties={properties}
        organizationId={organizationId}
        onClose={() => setPaymentModal({ isOpen: false, client: null, amount: '' })}
        onSuccess={() => {}}
      />
      <div className="animate-in fade-in duration-700 pb-20">
        
        {/* ────── MOBILE BRANDING HEADER ────── */}
        <div className="md:hidden flex flex-col items-center justify-center pt-2 pb-5 mb-4 border-b border-border-color/30 w-full animate-in slide-in-from-top-2 duration-500">
          <div className="flex items-center justify-center gap-2.5 w-full">
            <div className="shrink-0" style={{ width: '2.4rem', height: '2.4rem' }}>
              <img
                src="/logo.png"
                alt="Scapeflow Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1
              className="leading-none whitespace-nowrap"
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '2.4rem',
                fontWeight: 400,
                color: '#3d5a5e',
                letterSpacing: '-0.5px',
                lineHeight: 1
              }}
            >
              Scapeflow
            </h1>
          </div>
          <p className="text-[11.5px] font-medium text-center w-full mt-1.5" style={{ color: '#5b6b6d', letterSpacing: '0.01em' }}>
            {t('premiumSubtitle')}
          </p>
        </div>

      {/* ────── COMPACT PREMIUM HEADER ────── */}
      <div className="flex flex-row items-center justify-between gap-4 bg-gradient-to-r from-accent-color/10 via-transparent to-transparent p-3 md:p-5 md:min-h-[104px] rounded-2xl border border-accent-color/10 mb-4 md:mb-6 animate-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3 md:gap-5 w-full">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-accent-color flex items-center justify-center text-white shadow-xl shadow-accent-color/30 transform -rotate-3 hover:rotate-0 transition-transform duration-500 shrink-0">
            <LayoutDashboard className="w-5 h-5 md:w-7 md:h-7" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.png" alt="Scapeflow" className="w-3 h-3 md:w-4 md:h-4 object-contain drop-shadow-sm" />
              <h2 className="text-[9px] md:text-[11px] font-black text-accent-color uppercase tracking-[0.4em] leading-none">Scapeflow</h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-color text-white text-[8px] font-black uppercase tracking-tighter shadow-sm">{t('Intelligence Terminal')}</span>
            </div>
            <div className="flex items-center gap-2 mb-0.5 md:mb-1">
              <h1 className="text-lg md:text-3xl font-black text-main uppercase tracking-tighter leading-none">Dashboard</h1>
            </div>
            <p className="text-[9px] md:text-xs text-text-secondary font-bold uppercase tracking-[0.2em] opacity-60 hidden sm:block">
              {t('System Overview')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
            {lowStockProducts.length > 0 && (
              <div className="relative group cursor-pointer" onClick={() => onNavigate(Page.Administration)}>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></div>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-bg-card"></div>
                <div className="w-9 h-9 md:w-10 md:h-10 bg-bg-card border border-red-500/20 rounded-xl flex items-center justify-center text-red-500 shadow-sm">
                  <Bell size={18} />
                </div>
                <div className="absolute top-full right-0 mt-2 w-56 bg-bg-card border border-border-color rounded-xl shadow-2xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <p className="text-[11px] font-black text-red-500 uppercase tracking-[0.1em] mb-2">{t('Critical Stock Alerts')}</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                    {lowStockProducts.map(p => (
                      <div key={p.id} className="flex justify-between items-center py-1 border-b border-border-color/30 last:border-0">
                        <span className="text-[11px] font-bold text-main truncate">{p.name}</span>
                        <span className="text-red-500 font-black text-[11px]">{p.stock} {p.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 bg-bg-card px-3 py-2 md:px-4 md:py-2.5 rounded-xl border border-border-color shadow-sm">
                <span className="w-1.5 h-1.5 bg-accent-color rounded-full"></span>
                <span className="text-[11px] md:text-[11px] font-black text-accent-color uppercase tracking-widest hidden sm:block">Sync</span>
            </div>
        </div>
      </div>

      {/* ────── WEATHER ALERTS BANNER ────── */}
      {/* Alertele meteo inteligente sunt integrate în caseta Prognoza Lunii și în Misiune Prioritară */}

      {/* ────── LIVE ACTION TIMER WIDGET ────── */}
      {accountType !== 'PF' && latestActiveMission && (
        <div className="mb-4 md:mb-6 rounded-xl md:rounded-2xl shadow-xl shadow-accent-color/20 md:shadow-accent-color/5 animate-in slide-in-from-top duration-500 relative overflow-hidden group bg-accent-color md:bg-transparent md:bg-gradient-to-br md:from-accent-color/10 md:via-bg-card md:to-bg-card border-none md:border md:border-accent-color/25 p-3 md:p-4">
          <div className="hidden md:block absolute top-0 right-0 w-32 h-32 bg-accent-color/5 rounded-bl-full -z-10 blur-2xl"></div>
          <div className="flex flex-row items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-3 w-full min-w-0">
              <div className="hidden md:flex w-12 h-12 rounded-xl bg-accent-color items-center justify-center text-white shadow-lg shadow-accent-color/30 relative shrink-0">
                <Clock4 size={24} className="animate-spin duration-3000" style={{ animationDuration: '6s' }} />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-bg-card animate-pulse"></span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                  <span className="px-1.5 py-0.5 bg-white md:bg-red-500 text-accent-color md:text-white text-[8px] md:text-[9px] font-black rounded uppercase tracking-widest animate-pulse shadow-sm">LIVE</span>
                  <span className="text-[9px] md:text-[10px] font-bold text-white/80 md:text-text-secondary uppercase truncate">{latestActiveMission.assignedToName || t('Team')}</span>
                </div>
                <h3 className="text-sm md:text-base font-black text-white md:text-main leading-tight truncate">
                  {getClientDisplayName(latestActiveMission.clientId, latestActiveMission.clientName, clients)}
                </h3>
                <p className="text-[10px] md:text-[11px] font-medium text-white/70 md:text-text-secondary mt-0.5 flex items-center gap-1 truncate">
                  <MapPin size={10} className="shrink-0" /> <span className="truncate">{latestActiveMission.propertyAddress || t('No Address')}</span>
                </p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-end md:items-center gap-1 md:gap-4 shrink-0 bg-black/10 md:bg-bg-main/50 p-2 md:p-3 rounded-xl border border-white/10 md:border-border-color/40">
              <div className="text-right">
                <p className="text-[8px] md:text-[9px] font-black text-white/60 md:text-text-secondary uppercase tracking-widest mb-0.5 hidden md:block">{t('Time Elapsed') || 'TIMP SCURS'}</p>
                <p className="text-base md:text-xl font-mono font-black text-white md:text-accent-color leading-none">
                  {parseSafeTimestamp(latestActiveMission.currentSessionStart) && (
                    <Timer startTime={parseSafeTimestamp(latestActiveMission.currentSessionStart)!} />
                  )}
                </p>
              </div>
              <button 
                onClick={handleStopAll}
                className="mt-1 md:mt-0 px-3 py-1.5 md:px-4 md:py-2 bg-red-500 hover:bg-red-600 text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded md:rounded-lg shadow-md transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
              >
                <Square size={10} fill="currentColor" className="md:hidden" />
                {t('Stop')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPF && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Smart Weather forecast for the user */}
          <div className="md:col-span-2 stihl-card rounded-2xl p-6 border border-border-color shadow-xl bg-white dark:bg-bg-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
                  <CloudRain size={14} className="text-blue-500" />
                  Prognoză Meteo Inteligentă ({properties && properties.length > 0 && properties[0].address ? properties[0].address.split(',')[0].trim() : (userProfile?.localitate || 'Craiova')})
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg">
                  Senzor Conectat
                </span>
              </div>
              <Weather 
                lat={properties && properties.length > 0 && properties[0].latitude ? properties[0].latitude : undefined} 
                lon={properties && properties.length > 0 && properties[0].longitude ? properties[0].longitude : undefined} 
                address={properties && properties.length > 0 && properties[0].address ? properties[0].address : ([userProfile?.localitate, userProfile?.judet].filter(Boolean).join(', ') || 'Craiova, Romania')} 
                showForecast={true} 
                showFullForecast={true} 
              />
            </div>
          </div>

          {/* watering controller status */}
          <div className={`stihl-card rounded-2xl p-6 border shadow-xl bg-white dark:bg-bg-card flex flex-col justify-between relative overflow-hidden group ${
            (properties && properties.length > 0 && properties[0].wateringStatus === 'delayed_by_rain') 
            ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent' 
            : 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent'
          }`}>
            <div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
                  <Droplets size={14} className={(properties && properties.length > 0 && properties[0].wateringStatus === 'delayed_by_rain') ? 'text-amber-500' : 'text-emerald-500'} />
                  Sistem de Irigații
                </h3>
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                  (properties && properties.length > 0 && properties[0].wateringStatus === 'delayed_by_rain')
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                }`}>
                  {(properties && properties.length > 0 && properties[0].wateringStatus === 'delayed_by_rain') ? 'Amânat de ploaie' : 'Activ & Optimizat'}
                </span>
              </div>

              <div className="space-y-4 my-2">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    (properties && properties.length > 0 && properties[0].wateringStatus === 'delayed_by_rain')
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                    : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  }`}>
                    {(properties && properties.length > 0 && properties[0].wateringStatus === 'delayed_by_rain') ? <CloudRain size={24} /> : <Droplets size={24} />}
                  </div>
                  <div>
                    <p className="text-lg font-black text-main leading-none mb-1">
                      {(properties && properties.length > 0 && properties[0].wateringStatus === 'delayed_by_rain') ? 'Amânat Temporar' : 'Program Normal'}
                    </p>
                    <p className="text-[11px] font-medium text-text-secondary leading-snug">
                      {(properties && properties.length > 0 && properties[0].wateringStatus === 'delayed_by_rain')
                        ? 'Senzorii au detectat ploi abundente. Irigarea a fost oprită pentru prevenirea risipei.'
                        : 'Sistemul funcționează automat pe baza umidității solului.'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-bg-main rounded-xl border border-border-color space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-text-secondary">Ultima Alertă Meteo:</span>
                    <span className="text-main truncate max-w-[150px]">
                      {(properties && properties.length > 0 ? properties[0].lastWeatherAlert : null) || 'Fără alerte active'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-text-secondary">Umiditate Sol:</span>
                    <span className="text-main">38% (Optim)</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-text-secondary">Următorul Ciclu:</span>
                    <span className="text-main">
                      {(properties && properties.length > 0 && properties[0].wateringStatus === 'delayed_by_rain') ? 'Suspendat' : 'Mâine 06:00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              {(properties && properties.length > 0 && properties[0].wateringStatus === 'delayed_by_rain') ? (
                <button
                  onClick={async () => {
                    const propRef = doc(db, 'properties', properties[0].id);
                    await updateDoc(propRef, {
                      wateringStatus: 'normal',
                      lastWeatherAlert: null
                    });
                  }}
                  className="w-full py-2.5 bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10"
                >
                  Forcează Pornire Manuală
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const propRef = doc(db, 'properties', properties[0].id);
                    await updateDoc(propRef, {
                      wateringStatus: 'delayed_by_rain',
                      lastWeatherAlert: 'Suspendat manual de utilizator'
                    });
                  }}
                  className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/10"
                >
                  Suspendă Udarea (24h)
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ═══ CASH-FLOW BAND + NEEDS-ACTION (PJ only) — answers "cât am de încasat, cine e restant, ce e azi" in 2 seconds ═══ */}
      {!isPF && !loading && (() => {
        const collectedThisMonth = financialTotals.collectedMaintenanceThisMonth + financialTotals.collectedUniqueThisMonth;
        const debtorTotal = debtors.reduce((acc, c) => acc + (c.sold || 0), 0);
        const openToday = todayVisits.filter(v => v.status !== 'Finalizat' && v.status !== 'Anulat').length;
        const hasActions = debtors.length > 0 || openToday > 0;
        return (
          <div className="mb-6 space-y-3">
            {/* Cash-flow tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* De încasat (outstanding) */}
              <div className="stihl-card rounded-2xl border border-border-color bg-white dark:bg-bg-card shadow-lg p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-accent-color/10 text-accent-color flex items-center justify-center shrink-0">
                  <Wallet size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary leading-none mb-1">{t('To Collect')}</p>
                  <p className="text-xl font-black text-main leading-none truncate">{totalOutstanding.toLocaleString()} <span className="text-[10px] font-bold text-text-secondary/50">RON</span></p>
                </div>
              </div>
              {/* Restanțe (overdue debtors) — click opens Quick Collect list */}
              <button
                onClick={() => debtors.length > 0 && setShowDebtorModal(true)}
                className={`stihl-card rounded-2xl border shadow-lg p-4 flex items-center gap-3 text-left transition-all ${debtors.length > 0 ? 'border-red-500/30 bg-red-500/[0.03] hover:border-red-500/60 active:scale-[0.99] cursor-pointer' : 'border-border-color bg-white dark:bg-bg-card cursor-default'}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${debtors.length > 0 ? 'bg-red-500 text-white' : 'bg-text-secondary/10 text-text-secondary'}`}>
                  <HandCoins size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary leading-none mb-1">{t('Overdue')} {debtors.length > 0 && `· ${debtors.length}`}</p>
                  <p className={`text-xl font-black leading-none truncate ${debtors.length > 0 ? 'text-red-500' : 'text-main'}`}>{debtorTotal.toLocaleString()} <span className="text-[10px] font-bold text-text-secondary/50">RON</span></p>
                </div>
              </button>
              {/* Încasat luna asta (collected) */}
              <div className="stihl-card rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] shadow-lg p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <TrendingUp size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary leading-none mb-1">{t('Collected This Month')}</p>
                  <p className="text-xl font-black text-emerald-500 leading-none truncate">{collectedThisMonth.toLocaleString()} <span className="text-[10px] font-bold text-text-secondary/50">RON</span></p>
                </div>
              </div>
            </div>

            {/* Needs-action chips */}
            {hasActions && (
              <div className="stihl-card rounded-2xl border border-border-color bg-white dark:bg-bg-card shadow-lg p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Zap size={12} className="text-accent-color" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary">{t('Needs Action')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {debtors.length > 0 && (
                    <button
                      onClick={() => setShowDebtorModal(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-[11px] font-bold active:scale-95"
                    >
                      <HandCoins size={14} />
                      {t('Collect from {{count}} debtors', { count: debtors.length })}
                    </button>
                  )}
                  {openToday > 0 && (
                    <button
                      onClick={() => onNavigate(Page.Schedule)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-color/10 text-accent-color border border-accent-color/20 hover:bg-accent-color/20 transition-all text-[11px] font-bold active:scale-95"
                    >
                      <Calendar size={14} />
                      {t('{{count}} visits today', { count: openToday })}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-stretch">
        {/* 1. VREMEA SAMSUNG STYLE (SECOND) */}
        <div className="stihl-card rounded-2xl p-0 overflow-hidden border border-border-color shadow-xl lg:col-span-1 flex flex-col relative bg-gradient-to-br from-blue-50 to-white dark:from-bg-card/80 dark:to-bg-card order-2">
           <Weather 
             address={[orgLocalitate, orgJudet].filter(Boolean).join(', ') || orgAddress || 'Craiova, Romania'} 
             samsungMode={true}
             showForecast={false}
             showFullForecast={true}
           />
        </div>

        {/* 2. COMBINED: Misiune + Ultimele Vizite (FIRST) */}
        <div className="stihl-card rounded-2xl p-0 relative overflow-hidden group border border-border-color shadow-xl bg-white dark:bg-bg-card flex flex-col lg:col-span-2 order-1">
          <div className="grid grid-cols-1 md:grid-cols-2 flex-1 items-stretch">
            {/* ────── ZONA STANGA: Misiune ────── */}
            <div className="flex flex-col relative z-10 space-y-3 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-border-color/30">
            {/* Triunghi Decorativ pt zona stanga */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] sm:opacity-[0.08] dark:opacity-[0.12] pointer-events-none z-[-1]">
              <svg className="w-60 h-60 sm:w-80 sm:h-80 text-accent-color" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>



            {/* ────── HEADER ────── */}
            <div className="flex items-center gap-1.5 mb-4 relative z-10 opacity-50">
              <div className="w-1.5 h-1.5 bg-accent-color rounded-full"></div>
              <h3 className="text-text-secondary font-bold uppercase tracking-[0.15em] text-[9px]">
                {isPF ? t('Garden Care Plan') : t('Priority Mission')}
              </h3>
            </div>
            
            {loading ? (
            <MisiunePrioritaraSkeleton />
          ) : isPF ? (
            <div className="relative z-10 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                    {gardenRecommendations.length > 0 ? gardenRecommendations.map(rec => (
                        <div key={rec.id} className={`p-5 rounded-2xl border transition-all ${rec.priority === 'high' ? 'bg-red-500/5 border-red-500/20' : 'bg-bg-main border-border-color hover:border-accent-color/30'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rec.priority === 'high' ? 'bg-red-500 text-white' : 'bg-accent-color text-white'}`}>
                                    {rec.icon === 'Sprout' ? <Sprout size={20} /> : rec.icon === 'Droplets' ? <Droplets size={20} /> : <CloudRain size={20} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-lg font-black text-main leading-tight">{rec.title}</p>
                                        {rec.priority === 'high' && <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded uppercase tracking-tighter">Urgent</span>}
                                    </div>
                                    <p className="text-[11px] text-text-secondary font-medium leading-relaxed">{rec.description}</p>
                                </div>
                                <button 
                                    onClick={() => onNavigate(Page.GardenJournal)}
                                    className="px-4 py-2 bg-bg-card border border-border-color rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-accent-color hover:text-white transition-all shrink-0"
                                >
                                    {t('Log Activity')}
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="py-12 text-center opacity-40">
                             <p className="text-sm font-black uppercase tracking-[0.2em]">{t('Your garden is looking great!')}</p>
                        </div>
                    )}
                </div>
            </div>
          ) : nextVisit ? (
            <div className="relative z-10 space-y-3">
              <div>
                <p 
                  onClick={() => onNavigate(Page.Details, nextVisit.clientId)}
                  className="text-4xl font-black tracking-tighter text-[#1e293b] dark:text-white mb-2 leading-none cursor-pointer hover:text-accent-color transition-colors"
                >
                  {getClientDisplayName(nextVisit.clientId, nextVisit.clientName, clients)}
                </p>
                <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]"></div>
                    <span className="text-text-secondary">{formatVisitDate(nextVisit.data)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></div>
                    <span className="text-text-secondary">{nextVisit.tipLucrare || t('Maintenance')}</span>
                  </div>
                </div>
              </div>

              <p className="text-text-secondary text-lg font-medium leading-tight max-w-xl">
                "{nextVisit.detalii || 'Lucrare de rutină conform contract.'}"
              </p>

              <div className="flex flex-col gap-3 pt-1">
                {nextVisit.propertyAddress && (
                  <a 
                    href={getMapsUrl(nextVisit.propertyAddress, nextVisit.propertyMapsLink)} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[12px] font-bold text-accent-color hover:underline flex items-center gap-2"
                  >
                    📍 {nextVisit.propertyAddress}
                  </a>
                )}
                <button 
                  onClick={() => onNavigate(isPF ? Page.GardenJournal : Page.Schedule)} 
                  className="bg-accent-color text-white rounded-xl font-black uppercase tracking-widest text-[11px] px-8 py-3 shadow-xl shadow-accent-color/20 hover:scale-[1.02] active:scale-95 transition-all w-fit relative z-10"
                >
                  {isPF ? t('Garden Journal') : t('DESCHIDE MISIUNEA')}
                </button>
              </div>

              {/* ZONA DE JOS: Ticker Programari + Puls Financiar */}
              <div className="mt-8 pt-4 border-t border-border-color/30 relative z-10 pb-4 flex flex-col gap-6">
                
                {/* Urmatoarele programari - Vertical Auto-Scroll (Full width) */}
                {upcomingVisits && upcomingVisits.length > 1 ? (
                  <div className="w-full">
                    <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary/50 mb-2">
                       Următoarele Programări
                    </p>
                    <div className="h-[128px] overflow-hidden relative">
                      <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white dark:from-bg-card to-transparent z-10 pointer-events-none" />
                      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white dark:from-bg-card to-transparent z-10 pointer-events-none" />
                      
                      <div className="flex flex-col animate-scroll-y w-full">
                         {[...upcomingVisits.slice(1), ...upcomingVisits.slice(1)].map((v, idx) => (
                           <div key={idx} className="py-1.5 flex items-center justify-between text-[11px] opacity-70 hover:opacity-100 transition-opacity w-full">
                             <span className="font-bold text-main truncate pr-2">
                               {getClientDisplayName(v.clientId, v.clientName, clients)}
                             </span>
                             <span className="font-medium text-text-secondary shrink-0">{formatVisitDate(v.data).slice(0, 5)}</span>
                           </div>
                         ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-center opacity-40 py-4">
                     <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary text-center">Nicio programare viitoare</p>
                  </div>
                )}



              </div>
            </div>
          ) : (
            <div className="py-12 text-center relative z-10">
              <p className="text-text-secondary text-sm font-black uppercase tracking-[0.2em] opacity-40">{t('No critical mission')}</p>
            </div>
          )}
            </div>

            {/* ────── ZONA DREAPTA: Ultimele Vizite ────── */}
            <div className="flex flex-col relative p-6 sm:p-8 bg-bg-card/30">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
              <CheckCircle2 size={13} className="text-accent-color" />
              {t('Recent Completed Visits')}
            </h3>
            <button onClick={() => onNavigate(Page.AuditTrail)} className="text-[9px] font-black text-accent-color hover:underline uppercase tracking-widest px-2 py-1 rounded-lg bg-accent-color/5 hover:bg-accent-color/10 transition-colors">
              {t('Archive')} →
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
            {recentVisits && recentVisits.length > 0 ? recentVisits.slice(0, 6).map((v: Visit) => {
              const completedDate = v.completedAt?.toDate ? v.completedAt.toDate() : parseSafeDate(v.data);
              const daysPassed = completedDate ? differenceInDays(startOfDay(new Date()), startOfDay(completedDate)) : 0;
              const label = daysPassed === 0 ? 'azi' : daysPassed === 1 ? 'ieri' : `${daysPassed}z`;
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-border-color/40 hover:border-accent-color/30 hover:bg-bg-main/40 transition-all cursor-pointer group"
                  onClick={() => onNavigate(Page.Schedule)}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-color shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-main truncate group-hover:text-accent-color transition-colors">
                      {getClientDisplayName(v.clientId, v.clientName, clients)}
                    </p>
                    {v.propertyAddress && (
                      <p className="text-[9px] font-bold text-text-secondary/60 uppercase truncate flex items-center gap-0.5 mt-0.5">
                        <MapPin size={8} className="opacity-50" />
                        {v.propertyAddress}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <span className="text-[9px] font-black text-accent-color/70 bg-accent-color/8 px-1.5 py-0.5 rounded border border-accent-color/15">{label}</span>
                    <span className="text-[8px] font-bold text-text-secondary/50">
                      {v.completedAt?.toDate ? format(v.completedAt.toDate(), 'dd/MM') : formatVisitDate(v.data)}
                    </span>
                  </div>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-30 py-8">
                <History size={28} className="mb-2" />
                <p className="text-[11px] font-black uppercase tracking-widest">{t('No recent visits')}</p>
              </div>
            )}
            </div>
          </div>

          {/* ────── ZONA DE JOS FULL WIDTH: Puls Financiar ────── */}
          <div className="border-t border-border-color/30 bg-bg-main/30 p-6 w-full mt-auto md:col-span-2">
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
               {/* Mini Incalcari */}
               <div className="flex flex-col justify-center items-center py-6 px-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors text-center">
                 <div className="flex items-center gap-2 mb-3">
                   <CheckCircle2 size={16} className="text-emerald-500" />
                   <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400">Încasat</span>
                 </div>
                 <span className="text-2xl font-black text-main leading-none">{(financialTotals.collectedMaintenanceThisMonth + financialTotals.collectedUniqueThisMonth).toLocaleString()} <span className="text-[11px] font-bold text-text-secondary/50">RON</span></span>
               </div>
               
               {/* Mini Restant */}
               <div 
                 className="flex flex-col justify-center items-center py-6 px-4 rounded-xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors cursor-pointer group text-center relative"
                 onClick={() => setShowDebtorModal(true)}
               >
                 {debtors.length > 0 && <div className="absolute top-2.5 right-2.5 text-[10px] font-bold text-white bg-red-500 w-5 h-5 rounded-full flex items-center justify-center shadow-sm">{debtors.length}</div>}
                 <div className="flex items-center gap-2 mb-3">
                   <Bell size={16} className="text-red-500 group-hover:scale-110 transition-transform" />
                   <span className="text-[11px] font-black uppercase tracking-widest text-red-600/80 dark:text-red-400">Restant</span>
                 </div>
                 <span className="text-2xl font-black text-red-500 leading-none">{totalOutstanding.toLocaleString()} <span className="text-[11px] font-bold">RON</span></span>
               </div>

               {/* Mini Rata Colectare */}
               <div className="flex flex-col justify-center items-center py-6 px-4 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-colors text-center">
                 <div className="flex items-center gap-2 mb-3">
                   <BarChart2 size={16} className="text-blue-500" />
                   <span className="text-[11px] font-black uppercase tracking-widest text-blue-600/80 dark:text-blue-400">Rată Colectare</span>
                 </div>
                 <span className={`text-2xl font-black leading-none ${collectionRate >= 80 ? 'text-emerald-500' : collectionRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{collectionRate}%</span>
               </div>
             </div>
          </div>

        </div>
      </div>

{/* 2. GARDEN SCORE (PF only) */}
        {isPF && (

          <div className="stihl-card rounded-2xl p-6 border-l-4 border-emerald-500 shadow-xl bg-white dark:bg-bg-card flex flex-col h-full relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-bl-full -z-10 blur-3xl group-hover:bg-emerald-500/10 transition-colors"></div>
             
             <div className="flex justify-between items-start mb-6">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
                 <Sprout size={14} className="text-emerald-500" />
                 Garden Score
               </h3>
               <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-widest border ${getScoreBg(gardenScore)} ${getScoreColor(gardenScore)}`}>
                 {gardenScore >= 90 ? 'Excellent' : gardenScore >= 70 ? 'Good' : 'Needs Attention'}
               </span>
             </div>

             <div className="flex-1 flex flex-col items-center justify-center py-6">
                <div className="relative flex items-center justify-center w-32 h-32 mb-4">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-border-color"
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={getScoreColor(gardenScore)}
                      strokeWidth="3"
                      strokeDasharray={`${gardenScore}, 100`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className={`text-4xl font-black tracking-tighter ${getScoreColor(gardenScore)}`}>{gardenScore}</span>
                  </div>
                </div>
                <p className="text-[11px] text-text-secondary font-bold uppercase tracking-widest text-center max-w-[200px]">
                  {t('Your garden is thriving!')} {gardenScore < 100 && t('Complete overdue tasks to reach 100.')}
                </p>
             </div>

             <div className="mt-auto space-y-1.5 pt-4 border-t border-border-color/60">
                {activeVisit ? (
                  <button 
                    onClick={onStopWork}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                  >
                    <Square size={14} fill="currentColor" /> {t('Stop Activity')}
                  </button>
                ) : (
                  <button 
                    onClick={async () => {
                      if (isPF) {
                        onNavigate(Page.GardenJournal);
                        return;
                      }
                      if (clients.length === 0) return;
                      const pfClient = clients[0];
                      const pfProps = properties.filter(p => p.clientId === pfClient.id);
                      const pfProperty = pfProps.length > 0 ? pfProps[0] : null;
                      
                      const newVisit = {
                        organizationId,
                        clientId: pfClient.id,
                        clientName: pfClient.nume,
                        propertyId: pfProperty?.id || '',
                        propertyAddress: pfProperty?.address || pfClient.adresa || '',
                        status: 'Activ',
                        tipLucrare: 'Mentenanță',
                        data: new Date().toISOString().split('T')[0],
                        currentSessionStart: serverTimestamp(),
                        createdAt: serverTimestamp(),
                      };
                      await setDoc(doc(collection(db, 'visits')), newVisit);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                  >
                    <Sprout size={14} fill="currentColor" /> {t('Start Activity')}
                  </button>
                )}
             </div>
          </div>
        )}

                      </div>



      {/* ────── ANALYTICS SECTION (Moved Up) ────── */}
      
      {/* ROW 2: MONTHLY FORECAST + HEATMAP (full width) + TOP 5 CLIENTS */}
      <div className={`grid grid-cols-1 ${accountType === 'PF' ? 'lg:grid-cols-1' : 'lg:grid-cols-[6fr_8fr_6fr]'} gap-6 mt-6 items-stretch`}>
        {accountType !== 'PF' && userRole === 'admin' && (
          <div className="stihl-card rounded-2xl p-6 border border-border-color shadow-lg bg-bg-card flex flex-col h-full">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary mb-5 flex items-center gap-2">
              {isPF ? <Image size={14} className="text-accent-color" /> : <Sun size={14} className="text-accent-color" />}
              {t('Monthly Forecast')}
            </h3>
            <MonthlyForecastWidget visits={visits || []} augmentedClients={augmentedClients} properties={properties || []} weatherAlerts={weatherAlerts} />
          </div>
        )}

        <div className="stihl-card rounded-2xl p-6 border border-border-color shadow-lg bg-bg-card flex flex-col h-full">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary mb-5 flex items-center gap-2">
            <LayoutDashboard size={14} className="text-accent-color" />
            {t('Activity Heatmap')}
            <span className="text-[11px] font-bold text-text-secondary opacity-60 ml-auto normal-case tracking-normal">{t('Last 12 Weeks')}</span>
          </h3>
          <ActivityHeatmap visits={visits || []} />
        </div>
        
        {accountType !== 'PF' && userRole === 'admin' && (
          <div className="stihl-card rounded-2xl p-6 border border-border-color shadow-lg bg-bg-card flex flex-col h-full">
            <TopClientsWidget augmentedClients={augmentedClients} onNavigate={onNavigate} />
          </div>
        )}
      </div>

      {/* ────── OPERATIONAL KPIs / EXECUTION ────── */}
      {isPF && currentMonthGuide ? (
        <div className="mt-6">
          <div className="stihl-card rounded-2xl p-8 bg-bg-card border border-border-color shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-accent-color/5 rounded-bl-full -z-10 blur-3xl group-hover:bg-accent-color/10 transition-colors"></div>
              <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-accent-color/10 flex items-center justify-center text-accent-color shadow-inner">
                      <CalendarIcon size={24} />
                  </div>
                  <div>
                      <h3 className="text-xl font-black text-main uppercase tracking-tighter">{t('Seasonal Guide')}</h3>
                      <p className="text-[11px] text-text-secondary font-black uppercase tracking-[0.2em]">{currentMonthGuide.title}</p>
                  </div>
              </div>
              <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentMonthGuide.tasks.slice(0, 4).map((task: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-bg-main/50 border border-border-color/50">
                              <Check className="text-accent-color mt-0.5 shrink-0" size={14} />
                              <span className="text-[11px] font-bold text-main leading-snug">{task.title}</span>
                          </div>
                      ))}
                  </div>
                  <div className="p-4 rounded-2xl bg-accent-color/5 border border-accent-color/10 italic">
                      <p className="text-xs text-text-secondary leading-relaxed">
                          "{currentMonthGuide.summary}"
                      </p>
                  </div>
                  <button 
                      onClick={() => onNavigate(Page.CareCalendar)}
                      className="w-full py-3 rounded-xl border border-border-color font-black uppercase text-[11px] tracking-widest text-accent-color hover:bg-accent-color hover:text-white transition-all"
                  >
                      {t('View Full Monthly Calendar')}
                  </button>
              </div>
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${isPF ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-6 mt-6 items-stretch`}>
          {/* Col 1: Today's Field Activity */}
          <div className="stihl-card rounded-2xl p-4 border-l-4 border-accent-color shadow-xl bg-white dark:bg-bg-card flex flex-col min-h-[420px]">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-text-secondary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-accent-color rounded-full"></span>
                  {t("Today's Field Activity") || "Activitate Teren Azi"}
                </h3>
                <p className="text-base font-black text-main tracking-tighter leading-none">
                  {format(currentTime, 'HH:mm')}
                </p>
             </div>

             {/* Circular Gauge + Status pills */}
             <div className="flex items-center gap-4 bg-bg-main/50 p-2.5 rounded-xl border border-border-color/50 mb-3">
                <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-border-color" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-green-500" strokeWidth="3.5" strokeDasharray={`${todayActivityStats.rate}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-xs font-black text-main leading-none">{todayActivityStats.rate}%</span>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-1 text-center">
                  <div className="py-0.5 px-1 bg-green-500/20 rounded border border-green-500/30">
                    <span className="text-[11px] font-black text-white block leading-tight">{todayActivityStats.completed}</span>
                    <span className="text-[7px] font-black uppercase text-text-secondary tracking-widest leading-none">Fin</span>
                  </div>
                  <div className="py-0.5 px-1 bg-amber-500/20 rounded border border-amber-500/30 relative">
                    {todayActivityStats.active > 0 && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-accent-color rounded-full animate-ping"></span>}
                    <span className="text-[11px] font-black text-white block leading-tight">{todayActivityStats.active}</span>
                    <span className="text-[7px] font-black uppercase text-text-secondary tracking-widest leading-none">Act</span>
                  </div>
                  <div className="py-0.5 px-1 bg-blue-500/20 rounded border border-blue-500/30">
                    <span className="text-[11px] font-black text-white block leading-tight">{todayActivityStats.scheduled}</span>
                    <span className="text-[7px] font-black uppercase text-text-secondary tracking-widest leading-none">Prog</span>
                  </div>
                </div>
             </div>

             {/* Week & Month rates */}
             <div className="space-y-2 mb-3 flex-1">
               <div>
                 <div className="flex justify-between items-center mb-0.5">
                   <span className="text-[8px] font-black text-text-secondary uppercase tracking-widest">{t('Completion Rate (Week)')}</span>
                   <span className="text-[10px] font-black text-main">{thisWeekStats.rate}%</span>
                 </div>
                 <div className="w-full h-1 bg-border-color/30 rounded-full overflow-hidden">
                   <div className="h-full bg-accent-color rounded-full transition-all duration-1000" style={{ width: `${thisWeekStats.rate}%` }} />
                 </div>
                 <span className="text-[7px] font-bold text-text-secondary/60">{thisWeekStats.done}/{thisWeekStats.total} vizite saptamana aceasta</span>
               </div>
               <div>
                 <div className="flex justify-between items-center mb-0.5">
                   <span className="text-[8px] font-black text-text-secondary uppercase tracking-widest">{t('Completion Rate (Month)')}</span>
                   <span className="text-[10px] font-black text-main">{visitRate}%</span>
                 </div>
                 <div className="w-full h-1 bg-border-color/30 rounded-full overflow-hidden">
                   <div className="h-full bg-accent-color rounded-full transition-all duration-1000" style={{ width: `${visitRate}%` }} />
                 </div>
                 <span className="text-[7px] font-bold text-text-secondary/60">{visitStats.completedThisMonth}/{visitStats.totalThisMonth} vizite luna aceasta</span>
               </div>
             </div>

             {/* Footer */}
             <div className="pt-3 border-t border-border-color/60 space-y-1">
               <div className="flex justify-between items-center text-[11px]">
                 <span className="font-bold text-text-secondary uppercase">{t('Timeline')}:</span>
                 <span className="font-black text-main">{operationalTimeline.reduce((acc, d) => acc + d.visits.length, 0)} {t('Activities')}</span>
               </div>
               <div className="flex justify-between items-center text-[11px]">
                 <span className="font-bold text-text-secondary uppercase">{t('Operational')}:</span>
                 <span className="font-black text-accent-color">{clientCounts.active} C / {clientCounts.maintenance} M</span>
               </div>
             </div>
          </div>

          {/* Col 2: Teams & Missions Panel */}
          <div className="stihl-card rounded-2xl p-6 flex flex-col bg-bg-card border border-border-color overflow-hidden shadow-lg min-h-[420px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              {accountType !== 'PF' && (
                <div className="flex flex-col border-r border-border-color/30 pr-0 md:pr-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
                      <User size={14} className="text-accent-color" />
                      {t('Live Teams')}
                    </h3>
                    <span className="text-[11px] font-black bg-accent-color/10 text-accent-color px-2 py-1 rounded-lg uppercase tracking-tighter animate-pulse">LIVE</span>
                  </div>
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 flex-1">
                    {loading ? <EchipeTerenSkeleton /> : (
                      <>
                        {activeMissions.length > 0 ? activeMissions.map(v => {
                          const st = parseSafeTimestamp(v.currentSessionStart) || undefined;
                          return (
                            <div key={v.id} className="flex flex-col bg-bg-main/50 p-2.5 rounded-xl border border-border-color/50 hover:border-accent-color/30 transition-all cursor-pointer">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-black text-accent-color uppercase flex items-center gap-1.5 truncate">
                                  <div className="w-1.5 h-1.5 bg-accent-color rounded-full"></div>
                                  {v.assignedToName || t('Not Assigned')}
                                </span>
                                {st && <span className="text-[11px] font-mono font-black text-main bg-bg-card px-1.5 py-0.5 rounded border border-border-color/50"><Timer startTime={st} /></span>}
                              </div>
                              <span className="text-xs font-black text-main truncate">{getClientDisplayName(v.clientId, v.clientName, clients)}</span>
                              <span className="text-[11px] font-bold text-text-secondary uppercase truncate mt-0.5 opacity-60">{v.propertyAddress || t('No Address')}</span>
                            </div>
                          );
                        }) : (
                          <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                            <Clock4 size={28} className="mb-2" />
                            <p className="text-[11px] font-black uppercase tracking-widest">{t('No field team active')}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className={`flex flex-col ${isPF ? 'md:col-span-2' : ''}`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
                    <ClipboardList size={14} className="text-accent-color" />
                    {t('Missions Plan')}
                  </h3>
                  <span className="text-[11px] font-black text-text-secondary bg-bg-card px-2 py-1 rounded-lg border border-border-color/50 uppercase tracking-tighter">{grouped['Today'].length} {t('Today')}</span>
                </div>
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 flex-1">
                  {grouped['Today'].length > 0 ? grouped['Today'].map(v => {
                    const isDone = v.status === 'Finalizat';
                    const isLive = v.status === 'Activ';
                    return (
                      <div key={v.id} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${isDone ? 'bg-bg-main/30 border-transparent opacity-40 grayscale' : isLive ? 'bg-accent-color/5 border-accent-color/20' : 'bg-bg-main/50 border-border-color/50'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-main truncate leading-tight flex items-center">
                            {getClientDisplayName(v.clientId, v.clientName, clients)}
                            {(() => {
                              const days = isDone
                                ? calculateDaysSinceVisitCompleted(v)
                                : calculateDaysSinceLastVisit(visits, v.clientId, v.propertyId, v.id);
                              if (days === null) return null;
                              return (
                                <span className="ml-1 text-[10px] font-bold text-accent-color lowercase tracking-normal opacity-60">
                                  ({days} zile)
                                </span>
                              );
                            })()}
                          </p>
                          <div className="flex items-center gap-x-1.5 mt-0.5 min-w-0">
                            {v.propertyAddress && (
                              <span className="text-[9px] font-bold text-text-secondary/70 truncate flex items-center gap-0.5 uppercase tracking-wider max-w-[65%]">
                                <MapPin size={9} className="opacity-60" />
                                {v.propertyAddress}
                              </span>
                            )}
                            {v.propertyAddress && <span className="text-text-secondary/30 text-[9px]">•</span>}
                            <span className="text-[9px] font-medium text-text-secondary/50 uppercase truncate flex items-center gap-0.5 tracking-wider">
                              <User size={8} className="opacity-40" />
                              {v.assignedToName || t('Not Assigned')}
                            </span>
                          </div>
                        </div>
                        {isDone && <CheckCircle2 size={12} className="text-accent-color" />}
                      </div>
                    );
                  }) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                      <Calendar size={28} className="mb-2" />
                      <p className="text-[11px] font-black uppercase tracking-widest">{t('No schedule today')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {accountType !== 'PF' && userRole === 'admin' && activeMissions.length > 0 && (
              <button onClick={handleStopAll} className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-500 text-[11px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95 mt-6">
                {t('PANIC: Force Stop')}
              </button>
            )}
          </div>

          {/* Col 3 — Financial Status: Detailed breakdown (Maintenance + One-Time + Top Debtors) */}
          {accountType !== 'PF' && userRole === 'admin' && (
            <div className="stihl-card rounded-2xl p-6 flex flex-col border border-border-color shadow-lg bg-white dark:bg-bg-card min-h-[420px]">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-text-secondary mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <TrendingUp size={13} className="text-accent-color" />
                  {t('Financial Status')}
                </span>
                <span className="text-[10px] font-bold text-accent-color/80 bg-accent-color/10 px-2 py-0.5 rounded-full">
                  {new Date().toLocaleString(i18n.language, { month: 'long' })}
                </span>
              </h3>

              <div className="flex flex-col gap-4 flex-1">
                {/* Maintenance progress */}
                <div className="p-3 rounded-xl bg-bg-main/40 border border-border-color/30">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-[10px] font-black text-main uppercase tracking-tight flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-color inline-block" />
                      {t('Maintenance')}
                    </span>
                    <span className="text-[10px] font-bold text-text-secondary/80">
                      {financialTotals.collectedMaintenanceThisMonth.toLocaleString()} / {(financialTotals.collectedMaintenanceThisMonth + financialTotals.outstandingMaintenance).toLocaleString()} RON
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-border-color/20 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full rounded-l-full transition-all duration-1000"
                      style={{ width: `${(financialTotals.collectedMaintenanceThisMonth + financialTotals.outstandingMaintenance) > 0 ? (financialTotals.collectedMaintenanceThisMonth / (financialTotals.collectedMaintenanceThisMonth + financialTotals.outstandingMaintenance)) * 100 : 0}%` }}
                    />
                    <div
                      className="bg-red-400/80 h-full rounded-r-full transition-all duration-1000"
                      style={{ width: `${(financialTotals.collectedMaintenanceThisMonth + financialTotals.outstandingMaintenance) > 0 ? (financialTotals.outstandingMaintenance / (financialTotals.collectedMaintenanceThisMonth + financialTotals.outstandingMaintenance)) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold mt-1">
                    <span className="text-emerald-500">● {financialTotals.collectedMaintenanceThisMonth.toLocaleString()} RON încasat</span>
                    <span className="text-red-500">● {financialTotals.outstandingMaintenance.toLocaleString()} RON restant</span>
                  </div>
                </div>

                {/* One-time works progress */}
                <div className="p-3 rounded-xl bg-bg-main/40 border border-border-color/30">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-[10px] font-black text-main uppercase tracking-tight flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                      {t('One-Time Works')}
                    </span>
                    <span className="text-[10px] font-bold text-text-secondary/80">
                      {financialTotals.collectedUniqueThisMonth.toLocaleString()} / {(financialTotals.collectedUniqueThisMonth + financialTotals.outstandingUnique).toLocaleString()} RON
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-border-color/20 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full rounded-l-full transition-all duration-1000"
                      style={{ width: `${(financialTotals.collectedUniqueThisMonth + financialTotals.outstandingUnique) > 0 ? (financialTotals.collectedUniqueThisMonth / (financialTotals.collectedUniqueThisMonth + financialTotals.outstandingUnique)) * 100 : 0}%` }}
                    />
                    <div
                      className="bg-red-400/80 h-full rounded-r-full transition-all duration-1000"
                      style={{ width: `${(financialTotals.collectedUniqueThisMonth + financialTotals.outstandingUnique) > 0 ? (financialTotals.outstandingUnique / (financialTotals.collectedUniqueThisMonth + financialTotals.outstandingUnique)) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold mt-1">
                    <span className="text-emerald-500">● {financialTotals.collectedUniqueThisMonth.toLocaleString()} RON încasat</span>
                    <span className="text-red-500">● {financialTotals.outstandingUnique.toLocaleString()} RON restant</span>
                  </div>
                </div>

                {/* Top Debtors — compact clickable list */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest">{t('Debtors')}</p>
                    {debtors.length > 0 && (
                      <button onClick={() => setShowDebtorModal(true)} className="text-[9px] font-black text-accent-color uppercase tracking-widest hover:underline">
                        WhatsApp →
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                    {topDebtors.slice(0, 5).map(d => {
                      const soldVal = d.sold || 0;
                      const isCredit = soldVal < 0;
                      return (
                        <div key={d.id} onClick={() => onNavigate(Page.Details, d.id)}
                          className={`flex justify-between items-center p-2 rounded-lg border transition-all cursor-pointer group ${
                            isCredit ? 'border-blue-500/15 hover:border-blue-500/40 bg-blue-500/3'
                            : isDebtor(d, true) ? 'border-red-500/20 hover:border-red-500/50 bg-red-500/3'
                            : 'border-border-color/30 hover:border-accent-color/30'
                          }`}>
                          <div className="flex items-center gap-2 overflow-hidden min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              isCredit ? 'bg-blue-500' : isDebtor(d, true) ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                            }`} />
                            <span className="text-[11px] font-bold text-main truncate group-hover:text-accent-color transition-colors">{d.nume}</span>
                          </div>
                          <span className={`text-[11px] font-black flex-shrink-0 ml-2 ${
                            isCredit ? 'text-blue-500' : isDebtor(d, true) ? 'text-red-500' : 'text-emerald-500'
                          }`}>
                            {soldVal > 0 ? '+' : ''}{soldVal.toLocaleString()} <span className="text-[9px] font-normal opacity-40">RON</span>
                          </span>
                        </div>
                      );
                    })}
                    {topDebtors.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center opacity-30">
                        <CheckCircle2 size={24} className="mb-2 text-emerald-500" />
                        <p className="text-[11px] font-black uppercase tracking-widest">Toate conturile sunt ok</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────── INTERACTIVE MAP ────── */}
      <div className="mt-6 mb-6 stihl-card rounded-2xl overflow-hidden border border-border-color shadow-xl bg-bg-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color/50 bg-bg-main/30">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
            <MapPin size={13} className="text-accent-color" />
            Hartă Interactivă
            <span className="ml-1 text-[8px] font-bold text-text-secondary/40 normal-case tracking-normal">
              {format(new Date(), 'dd MMM yyyy', { locale: currentLocale })}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg">
              Programat {(visits || []).filter(v => v.status === 'Programat').length}
            </span>
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-accent-color/10 text-accent-color border border-accent-color/20 rounded-lg">
              Finalizat {(visits || []).filter(v => v.status === 'Finalizat').length}
            </span>
          </div>
        </div>
        <InteractiveMap organizationId={organizationId} />
      </div>

    </div>
    </>
  );
};

// ─── Analytics Sub-Components ──────────────────────────────────────────────





export default Dashboard;
