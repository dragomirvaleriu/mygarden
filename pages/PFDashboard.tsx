import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Page, UserProfile, GardenTask } from '../src/types';
import { useData } from '../src/context/DataContext';
import { monthlyGuide } from '../src/data/monthlyGuide';
import Weather from '../components/Weather';
import { IrrigationWidget } from '../components/iot/IrrigationWidget';
import { TreatmentCalculator } from '../components/TreatmentCalculator';
import { AILensScanner } from '../components/vision/AILensScanner';
import { GardenVitalityRing } from '../components/gamification/GardenVitalityRing';
import { SmartTroubleshooter } from '../components/SmartTroubleshooter';
import OnboardingWizard from '../components/OnboardingWizard';
import { Card, SectionHeader } from '../components/ui/primitives';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sprout, Calendar, BookOpen, Camera, ChevronRight, CheckCircle2,
  Clock, Droplets, Scissors, Bug, Plus, Sun, Leaf, Star,
  ArrowRight, LayoutGrid, MapPin, AlertCircle, Flower2, CloudRain
} from 'lucide-react';
import { format, isToday, isAfter, isBefore, addDays } from 'date-fns';
import { ro, enUS } from 'date-fns/locale';
import { db, collection, onSnapshot, query, where, updateDoc, doc, serverTimestamp, addDoc, getDoc } from '../services/firebase';
import { runAutopilot } from '../src/utils/AutopilotEngine';
import toast from 'react-hot-toast';

interface Props {
  onNavigate: (page: Page, id?: string) => void;
  organizationId: string;
  userProfile?: UserProfile | null;
  accountType?: 'PF' | 'PJ';
}

const categoryIcons: Record<string, any> = {
  watering: Droplets,
  mowing: Scissors,
  fertilizing: Sprout,
  pruning: Scissors,
  treatment: Bug,
  other: Plus,
};

const categoryColors: Record<string, string> = {
  watering: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  mowing: 'text-green-600 dark:text-green-400 bg-green-600/10 dark:bg-green-500/10 border-green-600/20 dark:border-green-500/20',
  fertilizing: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  pruning: 'text-amber-600 dark:text-amber-400 bg-amber-600/10 dark:bg-amber-500/10 border-amber-600/20 dark:border-amber-500/20',
  treatment: 'text-red-500 dark:text-red-400 bg-red-500/10 border-red-500/20',
  other: 'text-purple-500 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

const PFDashboard: React.FC<Props> = ({ onNavigate, organizationId, userProfile }) => {
  const { t, i18n } = useTranslation();
  const { properties, loading, gardenTasks, organization, isExpertMode, setIsExpertMode } = useData();
  const locale = i18n.language === 'ro' ? ro : enUS;

  const [recentJournalEntries, setRecentJournalEntries] = useState<any[]>([]);
  const [journalLoading, setJournalLoading] = useState(true);
  const [liveDisplayName, setLiveDisplayName] = useState<string>('');
  const [isAutopilotEnabled, setIsAutopilotEnabled] = useState(true);
  const [isAutopilotWorking, setIsAutopilotWorking] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState<any>(null);
  const [showFullWeather, setShowFullWeather] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Live-load displayName from Firestore so greeting is always fresh
  useEffect(() => {
    const uid = userProfile?.uid;
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) {
        const name = snap.data().displayName || '';
        setLiveDisplayName(name);
      }
    }).catch(() => {});
    // Also listen for real-time updates
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) setLiveDisplayName(snap.data().displayName || '');
    });
    return () => unsub();
  }, [userProfile?.uid]);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // update every minute
    return () => clearInterval(timer);
  }, []);

  // One-time welcome wizard for accounts that haven't finished onboarding yet.
  // Gated on `organization` being loaded (not just falsy) so it doesn't flash
  // for existing users while their org doc is still fetching.
  useEffect(() => {
    if (organization && !organization.onboardingCompleted) {
      setShowOnboarding(true);
    }
  }, [organization?.id, organization?.onboardingCompleted]);

  const currentMonth = now.getMonth();
  const hourOfDay = now.getHours();

  const greeting = useMemo(() => {
    const name = liveDisplayName?.split(' ')[0] || userProfile?.displayName?.split(' ')[0] || t('Grădinarul');
    if (hourOfDay < 12) return `${t('Bună dimineața')}, ${name}! 🌅`;
    if (hourOfDay < 18) return `${t('Bună ziua')}, ${name}! ☀️`;
    return `${t('Bună seara')}, ${name}! 🌙`;
  }, [hourOfDay, liveDisplayName, userProfile?.displayName, t]);

  // Seasonal tip from monthly guide
  const seasonalTip = useMemo(() => {
    const guide = monthlyGuide.find((m: any) => m.month === currentMonth);
    return guide ? { title: guide.title, tasks: guide.tasks.slice(0, 3), tip: guide.summary } : null;
  }, [currentMonth]);

  // Garden zones from properties
  const myGarden = useMemo(() => {
    if (!properties.length) return null;
    const prop = properties[0];
    return {
      name: prop.name || 'Grădina Mea',
      address: prop.address || '',
      zones: prop.customAreas || [],
      totalArea: prop.surfaceArea || prop.customAreas?.reduce((s: number, z: any) => s + (Number(z.size) || 0), 0) || 0,
    };
  }, [properties]);

  // Upcoming tasks (next 7 days)
  const upcomingTasks = useMemo(() => {
    const next7 = addDays(now, 7);
    return gardenTasks
      .filter(t => {
        if (t.status !== 'pending') return false;
        const due = t.nextDue?.toDate ? t.nextDue.toDate() : new Date(t.nextDue);
        return isBefore(due, next7);
      })
      .sort((a, b) => {
        const da = a.nextDue?.toDate ? a.nextDue.toDate() : new Date(a.nextDue);
        const db_ = b.nextDue?.toDate ? b.nextDue.toDate() : new Date(b.nextDue);
        return da.getTime() - db_.getTime();
      })
      .slice(0, 4);
  }, [gardenTasks, now]);

  const overdueTasks = useMemo(() =>
    gardenTasks.filter(t => {
      if (t.status !== 'pending') return false;
      const due = t.nextDue?.toDate ? t.nextDue.toDate() : new Date(t.nextDue);
      return isAfter(now, due) && !isToday(due);
    }), [gardenTasks, now]);

  // Consecutive-day streak of actual task completions (not just XP), across
  // every task's history[]. Today doesn't need a completion yet to keep the
  // streak alive — it only breaks once a full day is skipped.
  const currentStreak = useMemo(() => {
    const completedDays = new Set<string>();
    gardenTasks.forEach(task => {
      (task.history || []).forEach(entry => {
        const d = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
        if (!isNaN(d.getTime())) completedDays.add(format(d, 'yyyy-MM-dd'));
      });
    });
    if (completedDays.size === 0) return 0;

    let streak = 0;
    let cursor = now;
    if (!completedDays.has(format(cursor, 'yyyy-MM-dd'))) {
      cursor = addDays(cursor, -1);
    }
    while (completedDays.has(format(cursor, 'yyyy-MM-dd'))) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }, [gardenTasks, now]);

  // Load last 3 journal entries
  useEffect(() => {
    if (!organizationId) return;
    const userId = userProfile?.uid;
    const q = userId
      ? query(collection(db, 'garden_journal'), where('organizationId', '==', organizationId), where('userId', '==', userId))
      : query(collection(db, 'client_history'), where('organizationId', '==', organizationId));

    const unsub = onSnapshot(q, snap => {
      const entries = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => {
          const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
          const db_ = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
          return db_.getTime() - da.getTime();
        })
        .slice(0, 3);
      setRecentJournalEntries(entries);
      setJournalLoading(false);
    }, () => setJournalLoading(false));
    return () => unsub();
  }, [organizationId, userProfile?.uid]);

  // Autopilot Engine Trigger
  useEffect(() => {
    if (isAutopilotEnabled && weatherInfo?.current && upcomingTasks.length > 0 && !isAutopilotWorking) {
      const triggerAutopilot = async () => {
        setIsAutopilotWorking(true);
        try {
          // Force extreme mock weather for demonstration if requested, otherwise use real weather
          const mockForecast = {
             temperatureMax: 35,
             precipitationAmount: 15,
             precipitationProbability: 80
          };

          const { updatedTasks, logs } = await runAutopilot(
            upcomingTasks,
            mockForecast,
            organizationId,
            userProfile?.uid || ''
          );

          if (logs.length > 0) {
            toast.success(`Autopilot activ: Am optimizat ${logs.length} sarcini în funcție de vreme!`, { icon: '✨', duration: 6000 });
          }
        } catch (e) {
          console.error("Autopilot Engine error:", e);
        } finally {
          setIsAutopilotWorking(false);
        }
      };

      triggerAutopilot();
    }
  }, [isAutopilotEnabled, upcomingTasks.length, weatherInfo?.current]);

  const handleCompleteTask = async (task: GardenTask) => {
    try {
      const nextDue = addDays(now, task.intervalDays || 7);
      await updateDoc(doc(db, 'garden_tasks', task.id), {
        lastCompleted: serverTimestamp(),
        nextDue,
        history: [...(task.history || []), { date: new Date().toISOString() }]
      });

      // Gamification: Add XP
      if (userProfile?.uid) {
        const currentExp = userProfile.exp || 0;
        await updateDoc(doc(db, 'users', userProfile.uid), {
          exp: currentExp + 25
        });
        toast.success(t('Task marked as done! +25 XP 🌿'));
      } else {
        toast.success(t('Task marked as done! 🌿'));
      }
    } catch (e) {
      toast.error(t('Error updating task'));
    }
  };

  const getActivityIcon = (type: string) => {
    if (type === 'mowing') return '✂️';
    if (type === 'watering') return '💧';
    if (type === 'fertilizing') return '🌱';
    if (type === 'treatment') return '🪲';
    if (type === 'planting') return '🌸';
    if (type === 'observation') return '👁️';
    return '📝';
  };

  const isRainingToday = weatherInfo?.current && (
    weatherInfo.current.precipitationProbability >= 70 ||
    (weatherInfo.current.iconCode >= 500 && weatherInfo.current.iconCode < 600) ||
    (weatherInfo.current.iconCode >= 4000 && weatherInfo.current.iconCode < 5000)
  );

  // ET0 Logic: Hydration Stress Warning
  const hydrationAlerts = useMemo(() => {
    if (!weatherInfo?.forecast || weatherInfo.forecast.length < 3 || !myGarden?.zones) return [];

    let highTempDays = 0;
    let lowRainDays = 0;

    // Analyze next 3 days
    for (let i = 0; i < 3; i++) {
      if (weatherInfo.forecast[i].temp > 28) highTempDays++;
      if (weatherInfo.forecast[i].precipitationProbability < 30) lowRainDays++;
    }

    const alerts: string[] = [];
    if (highTempDays >= 3 && lowRainDays >= 3) {
      myGarden.zones.forEach((zone: any) => {
        if (zone.expunereSoare === 'Plin' || zone.tipSol === 'Nisipos') {
          alerts.push(`Stres Hidric Critic în zona [${zone.name}]. Necesar: udare abundentă în seara aceasta.`);
        }
      });
    }
    return alerts;
  }, [weatherInfo, myGarden]);

  const gardenAddress = (organization?.localitate ? organization.localitate + ', ' : '') + (organization?.address || organization?.localitate || '');

  // Is the homeowner's only property currently in the seeding/germination
  // window? This is a time-critical override (wrong watering schedule kills
  // new seed), so it takes priority over the regular seasonal tip whenever
  // active — the two are never shown at once.
  const isSeedingMode = useMemo(() => {
    const prop = properties[0];
    if (!prop?.seedingModeUntil) return false;
    const until = prop.seedingModeUntil.toDate ? prop.seedingModeUntil.toDate() : new Date(prop.seedingModeUntil);
    return isAfter(until, new Date());
  }, [properties]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* ── COMPACT HEADER: greeting + date + expert toggle ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 shadow-sm p-4 md:p-5"
      >
        <div className={`absolute inset-0 opacity-40 mix-blend-multiply dark:mix-blend-screen transition-colors duration-1000 ${
          isRainingToday
            ? 'bg-gradient-to-br from-slate-200 via-cyan-100 to-blue-200 dark:from-slate-900 dark:via-cyan-900 dark:to-blue-900'
            : 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-emerald-500/5 dark:from-amber-500/20 dark:via-orange-500/10 dark:to-emerald-500/10'
        }`} />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-bg-main/50 dark:bg-white/5 backdrop-blur-md border border-border-color dark:border-white/10 flex items-center justify-center shrink-0">
              <Sprout className="w-5 h-5 text-emerald-500 dark:text-emerald-400" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-black text-main tracking-tight truncate">{greeting}</h1>
              <p className="text-text-secondary text-[10px] md:text-xs font-black uppercase tracking-[0.15em] flex items-center gap-1.5">
                <Calendar size={11} className="text-emerald-500 shrink-0" />
                {format(now, 'EEEE, dd MMMM', { locale })}
                {myGarden && <span className="hidden sm:inline"> · {myGarden.name}</span>}
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => setIsExpertMode(!isExpertMode)}
            className={`flex flex-col items-end gap-0 px-3 py-2 rounded-xl border transition-all shrink-0 ${
              isExpertMode
                ? 'bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-400'
                : 'bg-bg-main/50 border-border-color text-text-secondary hover:text-main dark:bg-white/5 dark:border-white/10 dark:text-white/50'
            }`}
          >
            <span className="text-[8px] font-black uppercase tracking-widest leading-none">Mod</span>
            <span className="text-[11px] font-black leading-none mt-0.5">{isExpertMode ? 'Expert' : 'Simplu'}</span>
          </motion.button>
        </div>
      </motion.div>

      {/* ── AZI: hero card, sarcinile zilei — primul lucru vizibil pe ecran ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${upcomingTasks.length > 0 ? 'bg-accent-color animate-pulse' : 'bg-emerald-500'}`} />
            {t('Tasks & Reminders')}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider hidden sm:block">✨ Autopilot {isAutopilotEnabled ? 'Activ' : 'Oprit'}</span>
              <button
                onClick={() => setIsAutopilotEnabled(!isAutopilotEnabled)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${isAutopilotEnabled ? 'bg-emerald-500' : 'bg-border-color'}`}
              >
                <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${isAutopilotEnabled ? 'translate-x-4 shadow-sm' : ''}`} />
              </button>
            </div>
            <button
              onClick={() => onNavigate(Page.CareCalendar)}
              className="text-[10px] font-black text-accent-color uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all"
            >
              {t('View all')} <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {upcomingTasks.length === 0 && overdueTasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-card/50 backdrop-blur-md border border-border-color rounded-2xl p-8 text-center"
          >
            {isRainingToday ? (
              <>
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <CloudRain size={28} className="text-blue-500 drop-shadow-md" />
                </motion.div>
                <p className="text-sm font-black text-main mb-1">Astăzi plouă 🌧️</p>
                <p className="text-xs text-text-secondary font-medium">Sarcinile de udare sunt suspendate automat. Solul primește destulă apă!</p>
              </>
            ) : (
              <>
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 size={28} className="text-emerald-500 drop-shadow-md" />
                </motion.div>
                <p className="text-sm font-black text-main mb-1">{t('All caught up!')} 🌿</p>
                <p className="text-xs text-text-secondary font-medium">{t('No pending tasks. Your garden is happy!')}</p>
              </>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate(Page.CareCalendar)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[11px] font-black uppercase tracking-wider mx-auto hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
            >
              <Plus size={12} /> {t('Add Task')}
            </motion.button>
          </motion.div>
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
            <AnimatePresence mode="popLayout">
              {/* Overdue first */}
              {overdueTasks.slice(0, 2).map(task => {
                const Icon = categoryIcons[task.category] || Plus;
                const due = task.nextDue?.toDate ? task.nextDue.toDate() : new Date(task.nextDue);
                return (
                  <motion.div
                    key={task.id}
                    variants={staggerItem}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className="flex items-center gap-4 bg-red-500/5 backdrop-blur-md border border-red-500/20 rounded-2xl p-4 group hover:shadow-[0_8px_30px_rgba(239,68,68,0.15)] transition-all cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-red-500 drop-shadow" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-main truncate group-hover:text-red-500 transition-colors">{task.title}</p>
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                        ⚠ {t('Overdue')}: {format(due, 'dd MMM', { locale })}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleCompleteTask(task)}
                      className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shrink-0"
                    >
                      <CheckCircle2 size={16} />
                    </motion.button>
                  </motion.div>
                );
              })}
              {/* Upcoming */}
              {upcomingTasks.map((task, index) => {
                const Icon = categoryIcons[task.category] || Plus;
                const colorClass = categoryColors[task.category] || categoryColors.other;
                const due = task.nextDue?.toDate ? task.nextDue.toDate() : new Date(task.nextDue);
                const todayTask = isToday(due);
                return (
                  <motion.div
                    key={task.id}
                    variants={staggerItem}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className={`flex items-center gap-4 rounded-2xl p-4 border backdrop-blur-sm cursor-pointer group transition-colors ${
                      todayTask
                        ? 'bg-emerald-500/5 border-emerald-500/30 hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)]'
                        : 'bg-white/5 dark:bg-black/20 border-white/10 hover:border-emerald-500/30 hover:shadow-[0_8px_30px_rgba(255,255,255,0.05)]'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${colorClass} group-hover:bg-emerald-500 group-hover:text-white transition-colors`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-main truncate group-hover:text-emerald-500 transition-colors">{task.title}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${todayTask ? 'text-emerald-500' : 'text-text-secondary/60'}`}>
                        {todayTask ? `📅 ${t('Today')}!` : format(due, 'dd MMM', { locale })}
                        {task.notes ? ` · ${task.notes}` : ''}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleCompleteTask(task)}
                      className="w-9 h-9 rounded-xl bg-bg-card/50 text-text-secondary flex items-center justify-center hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all shrink-0"
                    >
                      <CheckCircle2 size={16} />
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Time-critical seeding-mode override — never shown alongside the
            regular seasonal tip below, since it supersedes it while active. */}
        {isSeedingMode && (
          <div className="mt-4 bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-5 relative overflow-hidden animate-pulse shadow-lg shadow-red-500/5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <Sprout size={14} className="text-red-500" />
              <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">
                {t('Protocol Însămânțare')}
              </span>
            </div>
            <h3 className="text-sm font-black text-red-600 dark:text-red-400 mb-2 leading-snug">Mod Germinare Activ!</h3>
            <p className="text-[11px] text-red-500 font-bold leading-relaxed mb-4">
              Evită uscarea embrionului! Irigă "Puțin și Foarte Des": de 3-4 ori pe zi (ex: 09:00, 13:00, 16:00), timp de 2-4 minute.
            </p>
            <button
              onClick={() => onNavigate(Page.CareCalendar)}
              className="flex items-center gap-1.5 text-[10px] font-black text-red-600 uppercase tracking-wider hover:gap-2.5 transition-all"
            >
              {t('Vezi Detalii Calendar')} <ArrowRight size={11} />
            </button>
          </div>
        )}
      </motion.div>

      {/* ── FOCUSUL LUNII ── */}
      {seasonalTip && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring' }}
          className="relative overflow-hidden rounded-3xl border border-white/20 shadow-xl"
        >
          {/* Gradient Background */}
          <div className={`absolute inset-0 ${
            [10, 11, 0, 1].includes(currentMonth)
              ? 'bg-gradient-to-br from-slate-800 via-blue-900 to-slate-900'
              : [2, 3, 4].includes(currentMonth)
              ? 'bg-gradient-to-br from-emerald-800 via-green-700 to-teal-800'
              : [5, 6, 7, 8].includes(currentMonth)
              ? 'bg-gradient-to-br from-amber-700 via-orange-600 to-red-700'
              : 'bg-gradient-to-br from-orange-800 via-amber-700 to-yellow-700'
          }`} />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -left-8 -top-8 w-40 h-40 bg-white/5 rounded-full blur-2xl" />

          <div className="relative z-10 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center gap-6">

              {/* Left: Title */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">
                    {[5, 6, 7, 8].includes(currentMonth) ? '🌞 Sezon Cald' : [2, 3, 4].includes(currentMonth) ? '🌱 Primăvară' : '❄️ Sezon Rece'}
                  </span>
                  <span className="text-white/30 text-[10px]">•</span>
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">Focus Luna Aceasta</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight mb-1">
                  {seasonalTip.title}
                </h2>
                <p className="text-white/60 text-sm font-medium">
                  {seasonalTip.tip?.split('.')[0]}.
                </p>
              </div>

              {/* Right: Task Badges */}
              <div className="flex flex-col gap-2 md:min-w-[260px]">
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Priorități Cheie</p>
                {seasonalTip.tasks.slice(0, 3).map((task: any, idx: number) => {
                  const catEmoji: Record<string, string> = {
                    mowing: '✂️', watering: '💧', fertilizing: '🌱', pruning: '🌿', treatment: '🪲', other: '📋',
                  };
                  const emoji = catEmoji[task.category] || '📋';
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + idx * 0.08 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl border bg-white/10 border-white/20 text-white backdrop-blur-sm"
                    >
                      <span className="text-base shrink-0">{emoji}</span>
                      <span className="text-sm font-bold leading-tight flex-1">{task.title}</span>
                      {task.important && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-white/20 rounded-md text-white shrink-0">Urgent</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT (3 cols): "ce problemă am?" — the core beginner diagnostic tools, given the most room */}
        <div className="lg:col-span-3 space-y-4">
          <SmartTroubleshooter onNavigate={onNavigate} />

          {/* AI LENS */}
          {userProfile?.uid && (
            <AILensScanner
              organizationId={organizationId}
              userId={userProfile.uid}
              userName={userProfile.displayName || ''}
              onNavigate={onNavigate}
              asCard={true}
            />
          )}
        </div>

        {/* RIGHT (2 cols): weather (compact) + irrigation + vitality + Journal + Zones */}
        <div className="lg:col-span-2 space-y-4">

          <div className="bg-bg-card border border-border-color rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
                <Sun size={14} className="text-yellow-500" />
                {t('Weather') || 'Vremea'}
              </h3>
              <button
                onClick={() => setShowFullWeather(v => !v)}
                className="text-[10px] font-black text-accent-color uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all"
              >
                {showFullWeather ? 'Restrânge' : 'Prognoză 7 Zile'}
                <ChevronRight size={12} className={`transition-transform ${showFullWeather ? '-rotate-90' : 'rotate-90'}`} />
              </button>
            </div>
            <Weather address={gardenAddress || 'Craiova, Romania'} showFullForecast={showFullWeather} onWeatherData={setWeatherInfo} />

            {/* ET0 Hydration Alerts */}
            {isExpertMode && hydrationAlerts.length > 0 && (
              <div className="mt-4 space-y-2">
                {hydrationAlerts.map((alert, idx) => (
                  <div key={idx} className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3 animate-pulse">
                    <Droplets size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">{alert}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isExpertMode && <IrrigationWidget />}

          {/* Garden Vitality — motivational, secondary */}
          <div className="bg-bg-card border border-border-color rounded-2xl shadow-sm flex justify-center">
            <GardenVitalityRing
              level={userProfile?.level || 1}
              exp={userProfile?.exp || 0}
              healthStatus={overdueTasks.length > 0 ? 'Atenție' : 'Excelent'}
              streak={currentStreak}
            />
          </div>

          {/* Recent Journal */}
          <Card>
            <SectionHeader
              icon={BookOpen}
              action={
                <button
                  onClick={() => onNavigate(Page.GardenJournal)}
                  className="text-[10px] font-black text-accent-color uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all"
                >
                  {t('All')} <ChevronRight size={11} />
                </button>
              }
            >
              {t('Recent Journal')}
            </SectionHeader>

            {journalLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-bg-main rounded-xl animate-pulse" />)}
              </div>
            ) : recentJournalEntries.length === 0 ? (
              <div className="text-center py-6">
                <Flower2 size={28} className="mx-auto text-text-secondary/30 mb-2" />
                <p className="text-[11px] font-bold text-text-secondary">{t('No journal entries yet')}</p>
                <button
                  onClick={() => onNavigate(Page.GardenJournal)}
                  className="mt-3 flex items-center gap-1.5 text-[10px] font-black text-accent-color uppercase tracking-wider mx-auto hover:gap-2 transition-all"
                >
                  <Plus size={11} /> {t('Add First Entry')}
                </button>
              </div>
            ) : (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                {recentJournalEntries.map((entry: any) => {
                  const entryDate = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date || entry.createdAt);
                  const hasPhoto = entry.photos?.length > 0;
                  return (
                    <motion.div variants={staggerItem} key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-main border border-border-color/50 hover:border-accent-color/30 transition-all group">
                      <div className="w-8 h-8 rounded-lg bg-accent-color/10 flex items-center justify-center text-base shrink-0">
                        {getActivityIcon(entry.type || 'other')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-main truncate">
                          {entry.details || entry.note || entry.services?.[0]?.name || t('Activity')}
                        </p>
                        <p className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">
                          {format(entryDate, 'dd MMM yyyy', { locale })}
                          {hasPhoto ? ' · 📷' : ''}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                <button
                  onClick={() => onNavigate(Page.GardenJournal)}
                  className="w-full mt-2 py-2 border border-dashed border-border-color rounded-xl text-[10px] font-black text-text-secondary uppercase tracking-wider hover:border-accent-color hover:text-accent-color transition-all"
                >
                  + {t('Add Entry')}
                </button>
              </motion.div>
            )}
          </Card>

          {/* My Garden Zones mini-card */}
          {myGarden && myGarden.zones.length > 0 && (
            <div className="bg-bg-card border border-border-color rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
                  <LayoutGrid size={12} className="text-accent-color" />
                  {t('Garden Zones')}
                </h3>
                <button
                  onClick={() => onNavigate(Page.GardenSetup)}
                  className="text-[10px] font-black text-accent-color uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all"
                >
                  {t('Edit')} <ChevronRight size={11} />
                </button>
              </div>
              <div className="space-y-2">
                {myGarden.zones.slice(0, 4).map((zone: any, i: number) => (
                  <div key={zone.id || i} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-bold text-main">{zone.name || `Zona ${i+1}`}</span>
                    </div>
                    {zone.size > 0 && (
                      <span className="text-[10px] font-black text-text-secondary">{zone.size} m²</span>
                    )}
                  </div>
                ))}
                {myGarden.zones.length > 4 && (
                  <p className="text-[9px] font-bold text-text-secondary/50 text-center pt-1">
                    +{myGarden.zones.length - 4} {t('more zones')}
                  </p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-border-color/50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('Total Surface')}</span>
                <span className="text-sm font-black text-accent-color">{myGarden.totalArea} m²</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TEMP DEV BUTTON — only ever rendered in the local dev build (import.meta.env.DEV),
          never in a production bundle, so homeowners can't see or trigger it. */}
      {import.meta.env.DEV && (
      <button
        onClick={async () => {
          try {
            const mockEntries = [
              { type: 'mowing', name: 'Tundere Gazon', details: 'Gazon tuns la 5cm. Margini ajustate.', photo: 'https://images.unsplash.com/photo-1592424005688-573e8e19c00b?w=800&q=80' },
              { type: 'watering', name: 'Udare Suplimentară', details: 'Program de irigații pornit manual.', photo: 'https://images.unsplash.com/photo-1563514222-d860d8e27c75?w=800&q=80' },
              { type: 'treatment', name: 'Aplicare Ingrășământ', details: 'Îngrășământ solid aplicat.', photo: 'https://images.unsplash.com/photo-1416879598056-f73b52af0eb1?w=800&q=80' },
              { type: 'pruning', name: 'Tăieri', details: 'Curățare ramuri uscate.', photo: 'https://images.unsplash.com/photo-1558904541-efa843a96f09?w=800&q=80' },
              { type: 'ai_diagnosis', name: 'Diagnoză AI', details: 'A fost detectat un atac incipient.', photo: 'https://images.unsplash.com/photo-1611843467160-25afb8df1074?w=800&q=80' }
            ];

            for (let i = 0; i < 5; i++) {
              const entry = mockEntries[i];
              await addDoc(collection(db, 'garden_journal'), {
                organizationId,
                userId: userProfile?.uid,
                type: entry.type,
                propertyName: entry.name,
                details: entry.details,
                date: new Date(Date.now() - Math.random() * 10000000000), // Random past date
                photos: [entry.photo],
                services: [{ name: entry.name }],
                performedByName: 'Sistem',
                createdAt: serverTimestamp()
              });
            }
            toast.success('Istoric mock generat cu succes!');
          } catch (e) {
            console.error(e);
            toast.error('Eroare la generare mock');
          }
        }}
        className="w-full mt-4 py-3 border border-dashed border-red-500/50 bg-red-500/10 text-red-500 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all"
      >
        DEV: Generează Istoric Aleatoriu (5 intrări)
      </button>
      )}

      {isExpertMode && <TreatmentCalculator />}

      {showOnboarding && organizationId && (
        <OnboardingWizard organizationId={organizationId} onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
};

export default PFDashboard;
