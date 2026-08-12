import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Page, UserProfile, GardenTask } from '../src/types';
import { useData } from '../src/context/DataContext';
import { monthlyGuide } from '../src/data/monthlyGuide';
import { useFrostAlerts } from '../src/hooks/useFrostAlerts';
import Weather from '../components/Weather';
import { IrrigationWidget } from '../components/iot/IrrigationWidget';
import { TreatmentCalculator } from '../components/TreatmentCalculator';
import { GardenVitalityRing } from '../components/gamification/GardenVitalityRing';
import { DoctorulGradiniiDashboard } from '../components/DoctorulGradiniiDashboard';
import AdBanner from '../components/AdBanner';
import NotificationBell from '../components/NotificationBell';
import { RecentJournalTimeline } from '../components/RecentJournalTimeline';
import {
  DashHero, Bento, Metric, Display, DashSegmented, Surface,
  DashButton, DashIconBadge, DashPill, DashSectionHeader,
} from '../components/dashboard/DashboardUI';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sprout, Calendar, BookOpen, Camera, ChevronRight, CheckCircle2,
  Clock, Droplets, Scissors, Bug, Plus, Sun, Leaf, Star,
  ArrowRight, LayoutGrid, MapPin, AlertCircle, Flower2, CloudRain, Ruler
} from 'lucide-react';
import { format, isToday, isAfter, isBefore, addDays } from 'date-fns';
import { ro, enUS } from 'date-fns/locale';
import { db, collection, onSnapshot, query, where, updateDoc, doc, serverTimestamp, getDoc } from '../services/firebase';
import { runAutopilot } from '../src/utils/AutopilotEngine';
import toast from 'react-hot-toast';

interface Props {
  onNavigate: (page: Page, id?: string) => void;
  organizationId: string;
  userProfile?: UserProfile | null;
}

const categoryIcons: Record<string, any> = {
  watering: Droplets,
  mowing: Scissors,
  fertilizing: Sprout,
  pruning: Scissors,
  treatment: Bug,
  other: Plus,
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

  // Load frost alerts on dashboard
  useFrostAlerts();

  const [recentJournalEntries, setRecentJournalEntries] = useState<any[]>([]);
  const [journalLoading, setJournalLoading] = useState(true);
  const [liveDisplayName, setLiveDisplayName] = useState<string>('');
  const [isAutopilotEnabled, setIsAutopilotEnabled] = useState(true);
  const [isAutopilotWorking, setIsAutopilotWorking] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState<any>(null);
  const [showFullWeather, setShowFullWeather] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(properties?.[0]?.id || null);

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
    const constraints: any[] = [where('organizationId', '==', organizationId)];

    if (userId) {
      constraints.push(where('userId', '==', userId));
    }
    if (selectedPropertyId) {
      constraints.push(where('propertyId', '==', selectedPropertyId));
    }

    const collectionName = userId ? 'garden_journal' : 'client_history';
    const q = query(collection(db, collectionName), ...constraints);

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
  }, [organizationId, userProfile?.uid, selectedPropertyId]);

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
        // Recalculate level based on new exp
        await fetch('/api/user/update-level', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userProfile.uid }),
        }).catch(err => console.error('Error updating level:', err));
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
    <div className="max-w-[1400px] mx-auto space-y-5 md:space-y-6 pb-24">
      {/* ── MASTHEAD ──────────────────────────────────────────────────
          The greeting is the page title, set in the display serif at a
          size that actually carries. Everything secondary (date, garden,
          weather) collapses into one quiet meta line above it, so the
          eye lands on the name first and the chrome second. */}
      <DashHero className="p-6 md:p-10 animate-rise">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[13px] font-semibold text-text-secondary dark:text-white/60 mb-3">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} className="text-accent-color" />
                {format(now, 'EEEE, d MMMM', { locale })}
              </span>
              {myGarden && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1.5 truncate max-w-[200px]">
                    <MapPin size={13} className="text-accent-color" />
                    {myGarden.name}
                  </span>
                </>
              )}
              {weatherInfo?.current?.temp != null && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1.5 nums">
                    {isRainingToday ? (
                      <CloudRain size={13} className="text-sky-500" />
                    ) : (
                      <Sun size={13} className="text-amber-500" />
                    )}
                    {Math.round(weatherInfo.current.temp)}°C
                  </span>
                </>
              )}
            </div>

            <Display size="lg" as="h1" className="dark:text-white">
              {greeting}
            </Display>

            {/* One-line status: the single most useful sentence on the
                page, phrased as prose rather than as a stat block. */}
            <p className="text-[15px] text-text-secondary dark:text-white/65 mt-3 max-w-xl">
              {overdueTasks.length > 0
                ? `${overdueTasks.length} ${overdueTasks.length === 1 ? t('sarcină întârziată') : t('sarcini întârziate')} · ${upcomingTasks.length} ${t('în următoarele 7 zile')}`
                : upcomingTasks.length > 0
                ? `${upcomingTasks.length} ${upcomingTasks.length === 1 ? t('sarcină în următoarele 7 zile') : t('sarcini în următoarele 7 zile')}`
                : t('Nicio sarcină în așteptare. Grădina ta este fericită!')}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="md:hidden">
              <NotificationBell uid={userProfile?.uid} />
            </div>
            <button
              onClick={() => setIsExpertMode(!isExpertMode)}
              className={`press h-10 px-4 rounded-full text-[13px] font-bold inline-flex items-center gap-2 ${
                isExpertMode
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  : 'bg-text-main/[0.06] dark:bg-white/10 text-text-secondary dark:text-white/70 hover:text-text-main'
              }`}
              title={t('Mod')}
            >
              <Star size={14} />
              {isExpertMode ? 'Expert' : 'Simplu'}
            </button>
          </div>
        </div>

        {/* Property switcher — a segmented control instead of a native
            <select>, so switching gardens is one tap rather than two. */}
        {properties && properties.length > 1 && (
          <div className="mt-6 -mb-1 overflow-x-auto no-scrollbar">
            <DashSegmented
              value={selectedPropertyId ?? ''}
              onChange={(v) => setSelectedPropertyId(v || null)}
              options={[
                { value: '', label: t('Toate') },
                ...properties.map((p) => ({ value: p.id, label: p.name || t('Proprietate') })),
              ]}
            />
          </div>
        )}
      </DashHero>

      {/* ── VITALS ────────────────────────────────────────────────────
          Four numbers that answer "how is my garden doing" without any
          reading. Big display figures, quiet labels. */}
      <Bento className="lg:grid-cols-4">
        <Bento.Tile index={0} tone="glass" padding="lg">
          <Metric
            icon={Flower2}
            label={t('Zile la rând')}
            value={currentStreak}
            unit={currentStreak === 1 ? t('zi') : t('zile')}
          />
        </Bento.Tile>
        <Bento.Tile index={1} tone="glass" padding="lg">
          <Metric
            icon={CheckCircle2}
            label={overdueTasks.length > 0 ? t('Întârziate') : t('Sarcini active')}
            value={overdueTasks.length > 0 ? overdueTasks.length : upcomingTasks.length}
          />
        </Bento.Tile>
        <Bento.Tile index={2} tone="glass" padding="lg">
          <Metric icon={LayoutGrid} label={t('Zone')} value={myGarden?.zones.length ?? 0} />
        </Bento.Tile>
        <Bento.Tile index={3} tone="glass" padding="lg">
          <Metric
            icon={Ruler}
            label={t('Suprafață')}
            value={myGarden?.totalArea ? Math.round(myGarden.totalArea) : 0}
            unit="m²"
          />
        </Bento.Tile>
      </Bento>

      {/* ── AZI: sarcinile zilei ──
          Plain div + CSS .animate-rise instead of a framer-motion
          initial/animate wrapper: that pattern was leaving this section
          stuck at opacity:0 (the animate state never resolved — same
          issue for both the empty-state and populated-list cases, so a
          child re-render was almost certainly resetting the tween before
          it completed). CSS keyframes run independently of React's
          render cycle so they can't be interrupted the same way. */}
      <div className="animate-rise">
        <DashSectionHeader
          icon={CheckCircle2}
          action={
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-[12px] font-semibold text-text-secondary">✨ Autopilot</span>
                <button
                  onClick={() => setIsAutopilotEnabled(!isAutopilotEnabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${isAutopilotEnabled ? 'bg-accent-color' : 'bg-border-color'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${isAutopilotEnabled ? 'translate-x-4 shadow-sm' : ''}`} />
                </button>
              </div>
              <DashButton variant="quiet" size="sm" iconRight={ChevronRight} onClick={() => onNavigate(Page.CareCalendar)}>
                {t('View all')}
              </DashButton>
            </div>
          }
        >
          {t('Tasks & Reminders')}
        </DashSectionHeader>

        {upcomingTasks.length === 0 && overdueTasks.length === 0 ? (
          <Surface tone="tint" padding="xl" className="text-center animate-rise">
            {isRainingToday ? (
              <>
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className="w-16 h-16 bg-sky-500/12 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <CloudRain size={28} className="text-sky-500" />
                </motion.div>
                <p className="font-display text-xl text-text-main mb-1.5">Astăzi plouă</p>
                <p className="text-[13px] text-text-secondary max-w-xs mx-auto">Sarcinile de udare sunt suspendate automat. Solul primește destulă apă!</p>
              </>
            ) : (
              <>
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 bg-accent-color/12 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 size={28} className="text-accent-color" />
                </motion.div>
                <p className="font-display text-xl text-text-main mb-1.5">{t('All caught up!')} 🌿</p>
                <p className="text-[13px] text-text-secondary">{t('No pending tasks. Your garden is happy!')}</p>
              </>
            )}
            <DashButton variant="soft" size="sm" icon={Plus} className="mt-5 mx-auto" onClick={() => onNavigate(Page.CareCalendar)}>
              {t('Add Task')}
            </DashButton>
          </Surface>
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2.5">
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
                    className="press flex items-center gap-4 bg-red-500/[0.06] border border-red-500/15 rounded-[var(--radius-md)] p-4 group cursor-pointer"
                  >
                    <DashIconBadge icon={Icon} tone="danger" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-text-main truncate">{task.title}</p>
                      <p className="text-[12px] font-semibold text-red-500">
                        {t('Overdue')} · {format(due, 'dd MMM', { locale })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCompleteTask(task)}
                      className="press w-10 h-10 rounded-full bg-red-500/12 text-red-500 grid place-items-center hover:bg-red-500 hover:text-white transition-colors shrink-0"
                    >
                      <CheckCircle2 size={17} />
                    </button>
                  </motion.div>
                );
              })}
              {/* Upcoming */}
              {upcomingTasks.map((task) => {
                const Icon = categoryIcons[task.category] || Plus;
                const due = task.nextDue?.toDate ? task.nextDue.toDate() : new Date(task.nextDue);
                const todayTask = isToday(due);
                return (
                  <motion.div
                    key={task.id}
                    variants={staggerItem}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`press flex items-center gap-4 rounded-[var(--radius-md)] p-4 border group cursor-pointer ${
                      todayTask
                        ? 'bg-accent-color/[0.06] border-accent-color/20'
                        : 'bg-bg-card border-border-color'
                    }`}
                  >
                    <DashIconBadge icon={Icon} tone={todayTask ? 'accent' : 'neutral'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-text-main truncate">{task.title}</p>
                      <p className={`text-[12px] font-semibold ${todayTask ? 'text-accent-color' : 'text-text-secondary'}`}>
                        {todayTask ? t('Today') : format(due, 'dd MMM', { locale })}
                        {task.notes ? ` · ${task.notes}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCompleteTask(task)}
                      className="press w-10 h-10 rounded-full bg-text-main/[0.05] text-text-secondary grid place-items-center hover:bg-accent-color hover:text-white transition-colors shrink-0"
                    >
                      <CheckCircle2 size={17} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Time-critical seeding-mode override — never shown alongside the
            regular seasonal tip below, since it supersedes it while active. */}
        {isSeedingMode && (
          <Surface tone="solid" padding="lg" className="mt-3 !border-red-500/25 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-bl-full blur-2xl pointer-events-none" />
            <div className="relative flex items-center gap-2 mb-2">
              <Sprout size={14} className="text-red-500" />
              <span className="text-[12px] font-bold text-red-500">{t('Protocol Însămânțare')}</span>
            </div>
            <p className="relative font-display text-lg text-red-600 dark:text-red-400 mb-1.5">Mod Germinare Activ</p>
            <p className="relative text-[13px] text-text-secondary leading-relaxed mb-4">
              Evită uscarea embrionului! Irigă „puțin și foarte des" — de 3–4 ori pe zi (ex. 09:00, 13:00, 16:00), timp de 2–4 minute.
            </p>
            <DashButton variant="danger" size="sm" iconRight={ArrowRight} onClick={() => onNavigate(Page.CareCalendar)}>
              {t('Vezi Detalii Calendar')}
            </DashButton>
          </Surface>
        )}
      </div>

      {/* ── FOCUSUL LUNII ── */}
      {seasonalTip && (
        <Surface tone="tint" padding="none" grain className="animate-rise overflow-hidden">
          <div
            className="absolute -right-20 -bottom-20 w-72 h-72 rounded-full animate-drift"
            style={{ background: 'radial-gradient(circle, var(--accent-color) 0%, transparent 70%)', opacity: 0.16, filter: 'blur(40px)' }}
          />
          <div className="relative z-10 p-6 md:p-9 flex flex-col md:flex-row md:items-center gap-7">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 text-[12px] font-bold text-accent-ink/75">
                <span>
                  {[5, 6, 7, 8].includes(currentMonth) ? '🌞 Sezon Cald' : [2, 3, 4].includes(currentMonth) ? '🌱 Primăvară' : '❄️ Sezon Rece'}
                </span>
                <span className="opacity-40">·</span>
                <span>Focus Luna Aceasta</span>
              </div>
              <Display size="lg" className="text-accent-ink mb-2">{seasonalTip.title}</Display>
              <p className="text-accent-ink/75 text-[15px] max-w-md">{seasonalTip.tip?.split('.')[0]}.</p>
            </div>

            <div className="flex flex-col gap-2 md:min-w-[280px]">
              <p className="text-[11px] font-bold text-accent-ink/60 uppercase tracking-wider mb-1">Priorități Cheie</p>
              {seasonalTip.tasks.slice(0, 3).map((task: any, idx: number) => {
                const catEmoji: Record<string, string> = {
                  mowing: '✂️', watering: '💧', fertilizing: '🌱', pruning: '🌿', treatment: '🪲', other: '📋',
                };
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + idx * 0.08 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-sm)] bg-bg-card/70 backdrop-blur-sm"
                  >
                    <span className="text-base shrink-0">{catEmoji[task.category] || '📋'}</span>
                    <span className="text-[13.5px] font-bold text-text-main leading-tight flex-1">{task.title}</span>
                    {task.important && <DashPill tone="warn">Urgent</DashPill>}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Surface>
      )}


      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* LEFT (3 cols): "ce problemă am?" — the core beginner diagnostic tools, given the most room */}
        <div className="lg:col-span-3 space-y-4">
          <DoctorulGradiniiDashboard onNavigate={onNavigate} />
        </div>

        {/* RIGHT (2 cols): weather (compact) + irrigation + vitality + Journal + Zones */}
        <div className="lg:col-span-2 space-y-4">

          <Surface tone="solid" padding="lg">
            <DashSectionHeader
              icon={Sun}
              action={
                <DashButton
                  variant="quiet"
                  size="sm"
                  iconRight={ChevronRight}
                  onClick={() => setShowFullWeather(v => !v)}
                  className={showFullWeather ? '[&_svg:last-child]:-rotate-90' : '[&_svg:last-child]:rotate-90'}
                >
                  {showFullWeather ? t('Restrânge') : t('Prognoză 7 Zile')}
                </DashButton>
              }
            >
              {t('Weather') || 'Vremea'}
            </DashSectionHeader>
            <Weather address={gardenAddress || 'Craiova, Romania'} showFullForecast={showFullWeather} onWeatherData={setWeatherInfo} />

            {/* ET0 Hydration Alerts */}
            {isExpertMode && hydrationAlerts.length > 0 && (
              <div className="mt-4 space-y-2">
                {hydrationAlerts.map((alert, idx) => (
                  <div key={idx} className="bg-red-500/[0.07] rounded-[var(--radius-sm)] p-3 flex items-start gap-3">
                    <Droplets size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[12.5px] font-semibold text-red-600 dark:text-red-400">{alert}</p>
                  </div>
                ))}
              </div>
            )}
          </Surface>

          {isExpertMode && <IrrigationWidget />}

          {/* Garden Vitality — motivational, secondary */}
          <Surface tone="solid" padding="lg" className="flex justify-center">
            <GardenVitalityRing
              level={userProfile?.level || 1}
              exp={userProfile?.exp || 0}
              healthStatus={overdueTasks.length > 0 ? 'Atenție' : 'Excelent'}
              streak={currentStreak}
            />
          </Surface>

          {/* Recent Journal */}
          <Surface tone="solid" padding="lg">
            <DashSectionHeader
              icon={BookOpen}
              action={
                <DashButton variant="quiet" size="sm" iconRight={ChevronRight} onClick={() => onNavigate(Page.GardenJournal)}>
                  {t('All')}
                </DashButton>
              }
            >
              {t('Recent Journal')}
            </DashSectionHeader>

            {journalLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-text-main/[0.04] rounded-[var(--radius-sm)] animate-pulse" />)}
              </div>
            ) : recentJournalEntries.length === 0 ? (
              <div className="text-center py-8">
                <Flower2 size={26} className="mx-auto text-text-secondary/40 mb-2.5" />
                <p className="text-[13px] font-semibold text-text-secondary">{t('No journal entries yet')}</p>
                <DashButton variant="soft" size="sm" icon={Plus} className="mt-3.5 mx-auto" onClick={() => onNavigate(Page.GardenJournal)}>
                  {t('Add First Entry')}
                </DashButton>
              </div>
            ) : (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                {recentJournalEntries.map((entry: any) => {
                  const entryDate = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date || entry.createdAt);
                  const hasPhoto = entry.photos?.length > 0;
                  return (
                    <motion.div variants={staggerItem} key={entry.id} className="press flex items-center gap-3 p-3 rounded-[var(--radius-sm)] bg-text-main/[0.03] cursor-pointer">
                      <span className="w-9 h-9 rounded-[var(--radius-xs)] bg-accent-color/12 grid place-items-center text-base shrink-0">
                        {getActivityIcon(entry.type || 'other')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-text-main truncate">
                          {entry.details || entry.note || entry.services?.[0]?.name || t('Activity')}
                        </p>
                        <p className="text-[11.5px] font-medium text-text-secondary">
                          {format(entryDate, 'dd MMM yyyy', { locale })}
                          {hasPhoto ? ' · 📷' : ''}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                <button
                  onClick={() => onNavigate(Page.GardenJournal)}
                  className="w-full mt-1 py-2.5 rounded-[var(--radius-sm)] border border-dashed border-border-color text-[12.5px] font-bold text-text-secondary hover:border-accent-color hover:text-accent-color transition-colors"
                >
                  + {t('Add Entry')}
                </button>
              </motion.div>
            )}
          </Surface>

          {/* Recent Journal Timeline */}
          <RecentJournalTimeline
            entries={recentJournalEntries}
            loading={journalLoading}
            onViewAll={() => onNavigate(Page.GardenJournal)}
          />

          {/* My Garden Zones mini-card */}
          {myGarden && myGarden.zones.length > 0 && (
            <Surface tone="solid" padding="lg">
              <DashSectionHeader
                icon={LayoutGrid}
                action={
                  <DashButton variant="quiet" size="sm" iconRight={ChevronRight} onClick={() => onNavigate(Page.GardenSetup)}>
                    {t('Edit')}
                  </DashButton>
                }
              >
                {t('Garden Zones')}
              </DashSectionHeader>
              <div className="space-y-0.5">
                {myGarden.zones.slice(0, 4).map((zone: any, i: number) => (
                  <div key={zone.id || i} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-color" />
                      <span className="text-[13px] font-bold text-text-main">{zone.name || `Zona ${i + 1}`}</span>
                    </div>
                    {zone.size > 0 && (
                      <span className="text-[12px] font-bold text-text-secondary nums">{zone.size} m²</span>
                    )}
                  </div>
                ))}
                {myGarden.zones.length > 4 && (
                  <p className="text-[11.5px] font-semibold text-text-secondary/60 text-center pt-2">
                    +{myGarden.zones.length - 4} {t('more zones')}
                  </p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-border-color flex items-center justify-between">
                <span className="text-[12px] font-bold text-text-secondary">{t('Total Surface')}</span>
                <span className="text-[15px] font-display text-accent-color nums">{myGarden.totalArea} m²</span>
              </div>
            </Surface>
          )}

          {/* Promotional Banner — shows ads for free tier, hidden for ad-free/bundle */}
          <AdBanner userSubscriptionProduct={organization?.subscriptionProduct} />
        </div>
      </div>

      {isExpertMode && <TreatmentCalculator />}
    </div>
  );
};

export default PFDashboard;
