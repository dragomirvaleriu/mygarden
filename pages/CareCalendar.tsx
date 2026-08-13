import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../src/context/DataContext';
import { GardenTask, Property, UserProfile } from '../src/types';
import { monthlyGuide } from '../src/data/monthlyGuide';
import { 
  Sprout, 
  Droplets, 
  ThermometerSun, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Scissors,
  Bug,
  PlusCircle,
  Star,
  Info,
  Wind,
  X,
  Camera
} from 'lucide-react';
import { format, isAfter, addDays, addWeeks, isToday, parseISO, getMonth } from 'date-fns';
import { db, collection, addDoc, updateDoc, doc, serverTimestamp, storage, ref, uploadBytes, getDownloadURL, auth } from '../services/firebase';
import { calendarCoverPath } from '../services/contentImages';
import ContentImage from '../components/ContentImage';
import AppBar from '../components/ui/AppBar';
import { compressImage } from '../utils/image';
import toast from 'react-hot-toast';

const categoryIcons = {
  watering: Droplets,
  mowing: Scissors,
  fertilizing: Sprout,
  pruning: Scissors,
  treatment: Bug,
  other: PlusCircle
};

const categoryColors = {
  watering: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  mowing: 'text-green-600 bg-green-600/10 border-green-600/20',
  fertilizing: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  pruning: 'text-amber-600 bg-amber-600/10 border-amber-600/20',
  treatment: 'text-red-500 bg-red-500/10 border-red-500/20',
  other: 'text-gray-500 bg-gray-500/10 border-gray-500/20'
};

interface CareCalendarProps {
  userProfile?: UserProfile | null;
}

type CarouselWindowSize = 3 | 5 | 7 | 9 | 11 | 13;

// How many month tiles the Protocol Timeline carousel shows at once, scaling
// with viewport width. Never fewer than 3 — one month back, the current one,
// one ahead — even on the narrowest phone, since a single bare tile loses the
// "what's coming up" context the carousel exists for. Tile size itself is
// capped (see CAROUSEL_GRID_CLASS below) — on a wide monitor the carousel
// used to stretch to `container-width / 5`, and since tiles are aspect-square
// that made them (and the whole section) far too tall. Instead of letting
// tiles grow, we keep them at a fixed max size and add more of them as space
// allows — up to 13 (six months back, six ahead) on very large/ultrawide
// displays, since there's genuinely room to show that much context there.
function computeCarouselWindowSize(width: number): CarouselWindowSize {
  if (width < 640) return 3;
  if (width < 900) return 5;
  if (width < 1200) return 7;
  if (width < 1500) return 9;
  if (width < 1800) return 11;
  return 13;
}

function useCarouselWindowSize(): CarouselWindowSize {
  const [size, setSize] = useState<CarouselWindowSize>(() =>
    typeof window !== 'undefined' ? computeCarouselWindowSize(window.innerWidth) : 5
  );
  useEffect(() => {
    const onResize = () => setSize(computeCarouselWindowSize(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

// Tailwind can't resolve a class built from a variable (`grid-cols-${n}`) —
// its scanner only sees literal strings in the source, so each option here
// must be spelled out in full rather than interpolated (same rule that bit
// the season colors earlier in this file). `minmax(0,92px)` is the actual
// size cap: 92px is roughly the tile size already in use, so this is a
// ceiling, not a change, on screens where 5 tiles were already comfortable.
const CAROUSEL_GRID_CLASS: Record<CarouselWindowSize, string> = {
  3: 'grid-cols-[repeat(3,minmax(0,92px))] justify-center',
  5: 'grid-cols-[repeat(5,minmax(0,92px))] justify-center',
  7: 'grid-cols-[repeat(7,minmax(0,92px))] justify-center',
  9: 'grid-cols-[repeat(9,minmax(0,92px))] justify-center',
  11: 'grid-cols-[repeat(11,minmax(0,92px))] justify-center',
  13: 'grid-cols-[repeat(13,minmax(0,92px))] justify-center',
};

// Given a window size N, returns offsets such as [-1,0,1] centered on
// whatever "active" index the caller adds them to — biased to include one
// extra item on the future side when N is even. Shared by the month
// carousel above and the season-legend window below so "centered on the
// active thing, N wide" means the same math in both places.
function centeredOffsets(windowSize: number): number[] {
  const before = Math.floor((windowSize - 1) / 2);
  return Array.from({ length: windowSize }, (_, i) => i - before);
}

// The season legend has only 4 possible values, so instead of scrolling to
// reveal the ones that don't fit, it shows a smaller centered window —
// just the active season on the narrowest phones, growing to all 4 once
// there's room. Mirrors the month carousel's approach for the same reason:
// dropping text was the alternative, and centering keeps "which season am I
// looking at" answerable at a glance rather than a swipe away.
function computeSeasonWindowSize(width: number): 1 | 2 | 3 | 4 {
  if (width < 400) return 1;
  if (width < 520) return 2;
  if (width < 700) return 3;
  return 4;
}

function useSeasonWindowSize(): 1 | 2 | 3 | 4 {
  const [size, setSize] = useState<1 | 2 | 3 | 4>(() =>
    typeof window !== 'undefined' ? computeSeasonWindowSize(window.innerWidth) : 4
  );
  useEffect(() => {
    const onResize = () => setSize(computeSeasonWindowSize(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

const CareCalendar: React.FC<CareCalendarProps> = ({ userProfile }) => {
  const { t } = useTranslation();
  const { gardenTasks, properties, loading, organization, globalSystemConfig, serviceTypes } = useData();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getMonth(new Date()));
  // Windowed carousel center — separate from selectedMonth so the arrows can
  // browse the timeline (e.g. peek ahead to next season) without yanking the
  // guide details below to a different month on every click. Selecting a
  // tile syncs the two back up.
  const [carouselCenter, setCarouselCenter] = useState(getMonth(new Date()));
  const carouselWindowSize = useCarouselWindowSize();
  // Bias any leftover tile toward the future rather than the past — knowing
  // what's coming next matters more here than what already happened. For an
  // even count (6) this yields e.g. 2 before + 3 after instead of 3 + 2.
  const carouselOffsets = centeredOffsets(carouselWindowSize);
  const seasonWindowSize = useSeasonWindowSize();
  const [taskToComplete, setTaskToComplete] = useState<GardenTask | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completionPhoto, setCompletionPhoto] = useState<File | null>(null);

  const [newTask, setNewTask] = useState<Partial<GardenTask> & { nextDueDate?: string }>({
    category: 'watering',
    frequency: 'custom',
    intervalDays: 7,
    status: 'pending',
    nextDueDate: format(new Date(), 'yyyy-MM-dd')
  });

  const months = [
    "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
    "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"
  ];

  // Illustrated month/season art (bundled static assets, not the Storage-backed
  // content-images/calendar/ cover system — these are fixed decorative
  // artwork baked into the design, not photos an admin swaps over time, so
  // they ship in the bundle instead of going through an async Storage fetch).
  const MONTH_IMAGES = [
    '/images/calendar/months/01-ianuarie.png',
    '/images/calendar/months/02-februarie.png',
    '/images/calendar/months/03-martie.png',
    '/images/calendar/months/04-aprilie.png',
    '/images/calendar/months/05-mai.png',
    '/images/calendar/months/06-iunie.png',
    '/images/calendar/months/07-iulie.png',
    '/images/calendar/months/08-august.png',
    '/images/calendar/months/09-septembrie.png',
    '/images/calendar/months/10-octombrie.png',
    '/images/calendar/months/11-noiembrie.png',
    '/images/calendar/months/12-decembrie.png',
  ];
  const SEASON_IMAGES = {
    Winter: '/images/calendar/seasons/season-iarna.png',
    Spring: '/images/calendar/seasons/season-primavara.png',
    Summer: '/images/calendar/seasons/season-vara.png',
    Autumn: '/images/calendar/seasons/season-toamna.png',
  } as const;

  // Meteorological seasons (Northern hemisphere) — one lookup shared by the
  // carousel tiles and the legend, so "which season am I looking at" always
  // agrees between the two.
  //
  // Every className below is written out in full, not built with
  // `${color}` interpolation. Tailwind's scanner matches literal substrings
  // in the source file — a class assembled at runtime from a variable is
  // invisible to it unless that exact string happens to appear elsewhere,
  // which is exactly the bug this replaced (autumn's `orange-600` combos
  // never appeared literally anywhere else in the app, so they were being
  // silently dropped from the CSS build).
  const SEASON_STYLES = {
    Winter: {
      icon: Wind,
      dot: 'bg-blue-500',
      iconActive: 'bg-blue-500/10 text-blue-500',
      topBarActive: 'bg-blue-500',
      borderActive: 'border-blue-500/30',
      ringActive: 'ring-blue-500/50',
      legendActive: 'bg-blue-500/10 text-blue-500',
      legendIcon: 'text-blue-500',
      panelBorder: 'border-blue-500/20',
      panelGradient: 'from-blue-500/5 via-transparent to-blue-500/5',
    },
    Spring: {
      icon: Sprout,
      dot: 'bg-accent-color',
      iconActive: 'bg-accent-color/10 text-accent-color',
      topBarActive: 'bg-accent-color',
      borderActive: 'border-accent-color/30',
      ringActive: 'ring-accent-color/50',
      legendActive: 'bg-accent-color/10 text-accent-color',
      legendIcon: 'text-accent-color',
      panelBorder: 'border-accent-color/20',
      panelGradient: 'from-accent-color/5 via-transparent to-accent-color/5',
    },
    Summer: {
      icon: ThermometerSun,
      dot: 'bg-amber-500',
      iconActive: 'bg-amber-500/10 text-amber-500',
      topBarActive: 'bg-amber-500',
      borderActive: 'border-amber-500/30',
      ringActive: 'ring-amber-500/50',
      legendActive: 'bg-amber-500/10 text-amber-500',
      legendIcon: 'text-amber-500',
      panelBorder: 'border-amber-500/20',
      panelGradient: 'from-amber-500/5 via-transparent to-amber-500/5',
    },
    Autumn: {
      icon: Droplets,
      dot: 'bg-orange-600',
      iconActive: 'bg-orange-600/10 text-orange-600',
      topBarActive: 'bg-orange-600',
      borderActive: 'border-orange-600/30',
      ringActive: 'ring-orange-600/50',
      legendActive: 'bg-orange-600/10 text-orange-600',
      legendIcon: 'text-orange-600',
      panelBorder: 'border-orange-600/20',
      panelGradient: 'from-orange-600/5 via-transparent to-orange-600/5',
    },
  } as const;
  type SeasonKey = keyof typeof SEASON_STYLES;
  const SEASON_ORDER: SeasonKey[] = ['Winter', 'Spring', 'Summer', 'Autumn'];
  const seasonKeyOf = (monthIdx: number): SeasonKey => {
    if (monthIdx === 0 || monthIdx === 1 || monthIdx === 11) return 'Winter';
    if (monthIdx >= 2 && monthIdx <= 4) return 'Spring';
    if (monthIdx >= 5 && monthIdx <= 7) return 'Summer';
    return 'Autumn';
  };
  const activeSeasonKey = seasonKeyOf(carouselCenter);
  const activeSeason = SEASON_STYLES[activeSeasonKey];
  const activeSeasonIndex = SEASON_ORDER.indexOf(activeSeasonKey);
  const visibleSeasons = centeredOffsets(seasonWindowSize)
    .map(offset => SEASON_ORDER[((activeSeasonIndex + offset) % 4 + 4) % 4]);

  const currentMonthGuide = useMemo(() => {
    const guideToUse = globalSystemConfig?.gardenGuide || monthlyGuide;
    return guideToUse.find((m: any) => m.month === selectedMonth);
  }, [selectedMonth, globalSystemConfig]);

  const overdueTasks = useMemo(() => 
    gardenTasks.filter(t => t.status === 'pending' && t.nextDue && isAfter(new Date(), t.nextDue.toDate ? t.nextDue.toDate() : new Date(t.nextDue))),
    [gardenTasks]
  );

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !newTask.title || !newTask.propertyId) return;

    setIsSubmitting(true);
    try {
      const { nextDueDate, ...taskData } = newTask;
      const nextDue = nextDueDate ? parseISO(nextDueDate) : new Date();
      await addDoc(collection(db, 'garden_tasks'), {
        ...taskData,
        organizationId: organization.id,
        createdAt: serverTimestamp(),
        nextDue: nextDue,
        status: 'pending',
        history: []
      });
      toast.success(t('Task added successfully'));
      setShowAddModal(false);
      setNewTask({ category: 'watering', frequency: 'custom', intervalDays: 7, status: 'pending', nextDueDate: format(new Date(), 'yyyy-MM-dd') });
    } catch (err) {
      console.error(err);
      toast.error(t('Error adding task'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteTaskConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskToComplete || !organization?.id) return;
    setIsSubmitting(true);
    try {
      const now = new Date();
      let nextDue: Date;
      
      switch (taskToComplete.frequency) {
        case 'daily': nextDue = addDays(now, 1); break;
        case 'weekly': nextDue = addWeeks(now, 1); break;
        case 'biweekly': nextDue = addWeeks(now, 2); break;
        case 'monthly': nextDue = addWeeks(now, 4); break;
        case 'custom': nextDue = addDays(now, taskToComplete.intervalDays || 7); break;
        default: nextDue = addDays(now, taskToComplete.intervalDays || 7);
      }

      let photoUrl = '';
      if (completionPhoto) {
        const compressedBlob = await compressImage(completionPhoto);
        const path = `uploads/${organization.id}/${auth.currentUser?.uid}/garden_tasks/${taskToComplete.id}_${Date.now()}_${completionPhoto.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, compressedBlob);
        photoUrl = await getDownloadURL(storageRef);
      }

      // Update Task
      await updateDoc(doc(db, 'garden_tasks', taskToComplete.id), {
        lastCompleted: serverTimestamp(),
        nextDue: nextDue,
        history: [...(taskToComplete.history || []), { date: new Date().toISOString(), note: completionNote, photoUrl }]
      });

      // Add to Client History for Garden Journal
      await addDoc(collection(db, 'client_history'), {
        organizationId: organization.id,
        clientId: taskToComplete.propertyId, // Usually linked to the property in PF
        propertyId: taskToComplete.propertyId,
        propertyName: properties.find(p => p.id === taskToComplete.propertyId)?.name || t('Grădină'),
        type: 'task_completion',
        date: serverTimestamp(),
        details: completionNote || taskToComplete.title,
        photos: photoUrl ? [photoUrl] : [],
        performedByName: t('Owner'),
        services: [{ name: taskToComplete.title }]
      });

      toast.success(t('Task completed!'));
      setTaskToComplete(null);
      setCompletionNote('');
      setCompletionPhoto(null);
    } catch (err) {
      console.error(err);
      toast.error(t('Error updating task'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-black uppercase tracking-widest opacity-30">{t('Loading Tasks...')}</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700">
      {/* ── Mobile app bar (R1) ──────────────────────────────────────
          The month is the whole point of this page, but it used to sit
          behind a 140px header, two stat cards and an image carousel —
          709px down an 812px screen. The month switcher now lives in the
          bar itself, so changing month is always one tap away. */}
      <AppBar
        title={t('Calendar')}
        actions={[{ icon: Plus, label: t('Register Activity'), onClick: () => setShowAddModal(true), primary: true }]}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedMonth((selectedMonth + 11) % 12)}
            aria-label={t('Luna anterioară')}
            className="press w-8 h-8 grid place-items-center rounded-full bg-bg-card border border-border-color text-text-secondary shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 text-center min-w-0">
            <span className="font-ui-title text-[15px] text-text-main">{months[selectedMonth]}</span>
          </div>
          <button
            onClick={() => setSelectedMonth((selectedMonth + 1) % 12)}
            aria-label={t('Luna următoare')}
            className="press w-8 h-8 grid place-items-center rounded-full bg-bg-card border border-border-color text-text-secondary shrink-0"
          >
            <ChevronRight size={16} />
          </button>
          {selectedMonth !== new Date().getMonth() && (
            <button
              onClick={() => setSelectedMonth(new Date().getMonth())}
              className="press shrink-0 px-2.5 h-8 rounded-full bg-accent-color/15 text-accent-color text-[12px] font-bold"
            >
              {t('Azi')}
            </button>
          )}
        </div>
      </AppBar>

      {/* ── PREMIUM TERMINAL HEADER (desktop only) ── */}
      <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-accent-color/10 via-transparent to-transparent p-4 md:p-6 md:min-h-[104px] rounded-3xl border border-accent-color/20 mb-6 shadow-sm gap-4">
        
        <div className="flex items-center gap-4 md:gap-5">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-accent-color flex items-center justify-center text-white shadow-lg shadow-accent-color/30 transform -rotate-3 hover:rotate-0 transition-transform duration-300 shrink-0">
            <CalendarIcon className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.png" alt="My Garden" className="w-3 h-3 md:w-4 md:h-4 object-contain drop-shadow-sm" />
              <h2 className="text-[9px] md:text-[11px] font-black text-accent-color uppercase tracking-[0.4em] leading-none">My Garden</h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-color text-white text-[8px] font-black uppercase tracking-tighter shadow-sm">{t('Intelligence Terminal')}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-main tracking-tight leading-tight mb-1">
              {t('Care Calendar')}
            </h1>
            <p className="text-text-secondary text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
              {t('Transitioning from hobbyist to expert')}
            </p>
          </div>
        </div>

        <div className="flex flex-row items-center justify-end gap-3 w-auto">
          {/* Seeding Mode Toggle */}
          {properties[0] && (
            <button
              onClick={async () => {
                const prop = properties[0];
                const currentlyActive = prop.seedingModeUntil ? isAfter(new Date(prop.seedingModeUntil.toDate ? prop.seedingModeUntil.toDate() : prop.seedingModeUntil), new Date()) : false;
                
                try {
                  if (currentlyActive) {
                    await updateDoc(doc(db, 'properties', prop.id), { seedingModeUntil: null, wateringStatus: 'normal' });
                    toast.success(t('Seeding Mode Dezactivat'));
                  } else {
                    const until = addDays(new Date(), 21);
                    await updateDoc(doc(db, 'properties', prop.id), { seedingModeUntil: until, wateringStatus: 'seeding_mode' });
                    toast.success(t('Seeding Mode Activat pentru 21 zile!'));
                  }
                } catch (e) {
                  toast.error('Eroare la actualizare');
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all ${
                (properties[0].seedingModeUntil && isAfter(new Date(properties[0].seedingModeUntil.toDate ? properties[0].seedingModeUntil.toDate() : properties[0].seedingModeUntil), new Date()))
                  ? 'bg-red-500 text-white shadow-red-500/20 hover:bg-red-600 animate-pulse'
                  : 'bg-bg-card border border-border-color text-text-secondary hover:text-main hover:border-accent-color'
              }`}
            >
              <Sprout size={14} />
              <span className="hidden sm:inline">
                {properties[0].seedingModeUntil && isAfter(new Date(properties[0].seedingModeUntil.toDate ? properties[0].seedingModeUntil.toDate() : properties[0].seedingModeUntil), new Date())
                  ? t('🌱 Mod Însămânțare Nouă (Activ)')
                  : t('Activează Mod Însămânțare')}
              </span>
            </button>
          )}

          {/* Add Event Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-color text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent-color/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">{t('Register Activity')}</span>
          </button>
        </div>
      </div>

      {/* Desktop-only status cards: on mobile the vegetation phase and task
          count are one compact strip further down rather than two stacked
          cards costing ~240px above the month itself. */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
           <div className="stihl-card bg-bg-card border border-border-color rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-accent-color/5 rounded-full blur-3xl group-hover:bg-accent-color/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">{t('Vegetation Phase')}</span>
                <div className={`px-2 py-0.5 bg-${(() => {
                  if (selectedMonth >= 2 && selectedMonth <= 4) return 'accent-color';
                  if (selectedMonth >= 5 && selectedMonth <= 7) return 'amber-500';
                  if (selectedMonth >= 8 && selectedMonth <= 10) return 'orange-600';
                  return 'blue-500';
                })()}/10 text-${(() => {
                  if (selectedMonth >= 2 && selectedMonth <= 4) return 'accent-color';
                  if (selectedMonth >= 5 && selectedMonth <= 7) return 'amber-600';
                  if (selectedMonth >= 8 && selectedMonth <= 10) return 'orange-700';
                  return 'blue-600';
                })()} text-[8px] font-black rounded-full uppercase tracking-widest border border-current/20`}>
                  {selectedMonth >= 2 && selectedMonth <= 4 ? t('Explozie') : 
                   selectedMonth >= 5 && selectedMonth <= 7 ? t('Maturitate') : 
                   selectedMonth >= 8 && selectedMonth <= 10 ? t('Declin') : t('Repaus')}
                </div>
              </div>
              <div>
                 <p className="text-xl font-black text-main uppercase tracking-tight mb-0.5">{months[selectedMonth]}</p>
                 <div className="flex items-center gap-1.5">
                    <ThermometerSun size={12} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-text-secondary">
                      {selectedMonth >= 2 && selectedMonth <= 9 ? t('Active Growth Phase') : t('Dormant Phase')}
                    </span>
                 </div>
              </div>
           </div>

           <div className="stihl-card bg-bg-card border border-border-color rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-accent-color/5 rounded-full blur-3xl group-hover:bg-accent-color/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">Personal Tasks</span>
                <span className="px-2 py-0.5 bg-accent-color text-white text-[9px] font-black rounded-full shadow-md shadow-accent-color/10">{overdueTasks.length} {t('Pending')}</span>
              </div>
              <div>
                 <p className="text-xl font-black text-main uppercase tracking-tight mb-0.5">Protocol Live</p>
                 <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-accent-color" />
                    <span className="text-[10px] font-bold text-text-secondary">Synced with Guide</span>
                 </div>
              </div>
           </div>
        </div>
      {/* ELITE TIMELINE SELECTOR */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-2 px-2">
           <h2 className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2 whitespace-nowrap">
              <div className="w-1 h-1 bg-accent-color rounded-full animate-ping"></div>
              {t('Protocol Timeline')}
              <button
                onClick={() => {
                  const now = getMonth(new Date());
                  setSelectedMonth(now);
                  setCarouselCenter(now);
                  setTimeout(() => {
                    document.getElementById('guide-details')?.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                className="shrink-0 px-2 py-0.5 rounded-full bg-accent-subtle border border-accent-border text-accent-ink text-[9px] font-black uppercase tracking-widest hover:bg-accent-color hover:text-accent-text transition-colors"
              >
                {t('Acum')}
              </button>
           </h2>
           {/* All 4 season labels never fit next to the title on a narrow
               phone. Rather than dropping text or making the user swipe to
               see the rest, this shows a smaller centered window — just the
               active season when space is tightest, growing to all 4 once
               there's room — the same windowing idea as the month carousel
               below, sized for what 1-2 words of Romanian actually need. */}
           <div className="flex items-center gap-2 shrink-0">
              {visibleSeasons.map(key => {
                  const style = SEASON_STYLES[key];
                  const isActive = activeSeasonKey === key;
                  return (
                    <div
                      key={key}
                      className={`relative w-16 aspect-video rounded-lg overflow-hidden shrink-0 transition-all duration-300 ${
                        isActive ? `ring-2 ${style.ringActive} opacity-100` : 'opacity-40'
                      }`}
                    >
                       <img
                         src={SEASON_IMAGES[key]}
                         alt={t(key) as string}
                         className="absolute inset-0 w-full h-full object-cover"
                       />
                       {/* Discreet name overlay at the bottom of the image, not
                           beside it — this is the "poza cu scrisul peste, jos"
                           treatment the user asked for. */}
                       <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pt-2 pb-0.5">
                          <span className="block text-center text-[5px] font-black uppercase tracking-tighter text-white leading-none">
                            {t(key)}
                          </span>
                       </div>
                    </div>
                  );
                })}
           </div>
        </div>

        <div className={`relative rounded-2xl border ${activeSeason.panelBorder} bg-gradient-to-r ${activeSeason.panelGradient} transition-colors duration-500 px-2 py-3`}>
          <div className="flex items-center gap-2">
            {/* Prev — steps the window back one month without disturbing which month is selected below */}
            <button
              onClick={() => setCarouselCenter(prev => (prev === 0 ? 11 : prev - 1))}
              aria-label={t('Previous month') as string}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-bg-card border border-border-color text-text-secondary hover:text-main hover:border-accent-color/30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Windowed carousel centered on carouselCenter — 1 to 6 tiles
                depending on viewport width — instead of a 12-wide scroller
                nobody wants to drag through on mobile, or a 5-wide grid that
                stretched tiles (and the whole section) too tall on desktop. */}
            <div className={`flex-1 grid gap-2 ${CAROUSEL_GRID_CLASS[carouselWindowSize]}`}>
              {carouselOffsets.map(offset => {
                const idx = ((carouselCenter + offset) % 12 + 12) % 12;
                const monthName = months[idx];
                const seasonKey = seasonKeyOf(idx);
                const season = SEASON_STYLES[seasonKey];
                const isSelected = selectedMonth === idx;
                const isCenter = offset === 0;

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedMonth(idx);
                      setCarouselCenter(idx);
                      setTimeout(() => {
                        document.getElementById('guide-details')?.scrollIntoView({ behavior: 'smooth' });
                      }, 50);
                    }}
                    className={`relative aspect-square rounded-xl border transition-all duration-300 flex flex-col items-center justify-center p-2 group/month
                      ${isSelected
                        ? `bg-bg-card ${season.borderActive} shadow-md z-10`
                        : 'bg-bg-card/40 border-border-color hover:border-border-color/80 hover:bg-bg-card/60'
                      }
                      ${isCenter ? 'scale-105' : 'scale-95 opacity-80'}
                    `}
                  >
                    <div className={`absolute top-0 inset-x-4 h-0.5 rounded-b-full transition-all duration-300
                      ${isSelected ? `${season.topBarActive} opacity-100` : `${season.topBarActive} opacity-0 group-hover/month:opacity-30`}
                    `}></div>

                    <div className={`relative w-full aspect-[8/5] rounded-lg overflow-hidden mb-1 transition-all duration-300
                      ${isSelected
                        ? `ring-2 ${season.ringActive} opacity-100`
                        : 'opacity-40 group-hover/month:opacity-80'
                      }`}
                    >
                      <img
                        src={MONTH_IMAGES[idx]}
                        alt={monthName}
                        className="absolute inset-0 w-full h-full object-cover bg-bg-main"
                      />
                    </div>

                    <span className={`text-[10px] font-black uppercase tracking-wider transition-all
                      ${isSelected ? 'text-main' : 'text-text-secondary opacity-60'}
                    `}>
                      {monthName.substring(0, 3)}
                    </span>

                    {isCenter && !isSelected && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-color" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCarouselCenter(prev => (prev === 11 ? 0 : prev + 1))}
              aria-label={t('Next month') as string}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-bg-card border border-border-color text-text-secondary hover:text-main hover:border-accent-color/30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* MONTHLY GUIDE DETAILS */}
      <div id="guide-details" className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-10">
        {/* Left: Expert Content */}
        {/* min-w-0 is load-bearing: a grid item defaults to min-width:auto, so
            without it the title row below (icon + long month title + nav
            pill, all in one unwrapped flex row) refuses to shrink and instead
            overflows past this column straight into the col-span-4 sidebar at
            mid-desktop widths — that was the visual overlap with the
            Schedule card. */}
        <div className="lg:col-span-8 min-w-0 space-y-10">
           {currentMonthGuide ? (
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                 <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-8">
                    <div className="flex items-center gap-6 min-w-0">
                       <ContentImage
                         path={calendarCoverPath(currentMonthGuide.month)}
                         alt={currentMonthGuide.title}
                         className="w-20 h-20 shrink-0 rounded-[2rem] object-cover shadow-2xl rotate-3 transition-transform hover:rotate-0"
                         fallback={
                           <div className="w-20 h-20 shrink-0 rounded-[2rem] bg-accent-color text-white flex items-center justify-center shadow-2xl shadow-accent-color/30 rotate-3 transition-transform hover:rotate-0">
                              <CalendarIcon size={32} />
                           </div>
                         }
                       />
                       <div className="min-w-0">
                          <h2 className="text-4xl font-black text-main uppercase tracking-tighter leading-none mb-2 truncate">
                             {currentMonthGuide.title}
                          </h2>
                          <p className="text-lg font-bold text-text-secondary opacity-60 truncate">
                             {currentMonthGuide.subtitle}
                          </p>
                       </div>
                    </div>

                    <div className="hidden md:flex items-center gap-2 bg-bg-card border border-border-color rounded-2xl p-1.5 shadow-sm shrink-0">
                       <button 
                         onClick={() => setSelectedMonth(prev => prev === 0 ? 11 : prev - 1)}
                         className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-main transition-colors text-text-secondary"
                       >
                         <ChevronLeft size={18} />
                       </button>
                       <span className="px-4 text-[11px] font-black uppercase tracking-widest text-accent-color">{months[selectedMonth]}</span>
                       <button 
                         onClick={() => setSelectedMonth(prev => prev === 11 ? 0 : prev + 1)}
                         className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-main transition-colors text-text-secondary"
                       >
                         <ChevronRight size={18} />
                       </button>
                    </div>
                 </div>

                  {(() => {
                    const prop = properties[0];
                    const isSeedingMode = prop?.seedingModeUntil ? isAfter(new Date(prop.seedingModeUntil.toDate ? prop.seedingModeUntil.toDate() : prop.seedingModeUntil), new Date()) : false;

                    if (isSeedingMode) {
                      return (
                        <div className="mb-6 p-6 rounded-2xl bg-red-500/10 border-2 border-red-500/30 flex items-start gap-4 shadow-lg shadow-red-500/5 animate-pulse">
                          <AlertCircle size={28} className="text-red-500 shrink-0 mt-1" />
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-red-500 mb-1">{t('🌱 Protocol de Germinare (Mod Însămânțare)')}</h4>
                            <p className="text-sm font-bold text-red-600 dark:text-red-400">
                              {t('Evită uscarea embrionului! Sămânța și nisipul NU au voie să se usuce deloc. Irigă "Puțin și Foarte Des": de 3-4 ori pe zi (ex: 09:00, 13:00, 16:00), timp de 2-4 minute.')}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return currentMonthGuide.warning && (
                      <div className="mb-6 p-6 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-start gap-4 shadow-lg shadow-amber-500/5">
                        <AlertCircle size={28} className="text-amber-500 shrink-0 mt-1" />
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-amber-500 mb-1">{t('Avertisment / Reguli Lunare')}</h4>
                          <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                            {currentMonthGuide.warning}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="stihl-card rounded-[2.5rem] bg-bg-card border border-border-color shadow-2xl overflow-hidden relative group mb-8">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent-color/5 rounded-bl-full -z-10 blur-3xl group-hover:bg-accent-color/10 transition-colors"></div>
                    
                    <div className="p-8 lg:p-10 space-y-8">
                      <p className="text-lg font-medium text-main leading-relaxed">
                        {currentMonthGuide.summary}
                      </p>

                      <div className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-accent-color" />
                          {t('Mandatory Tasks')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {currentMonthGuide.tasks.map((task: any) => {
                            const Icon = categoryIcons[task.category as keyof typeof categoryIcons] || PlusCircle;
                            const colorClass = categoryColors[task.category as keyof typeof categoryColors] || categoryColors.other;
                            
                            return (
                              <div key={task.id} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${task.important ? 'border-accent-color/30 bg-accent-color/5' : 'border-border-color bg-bg-main'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                                  <Icon size={18} />
                                </div>
                                <div className="mt-1">
                                  <span className="text-sm font-bold text-main leading-snug block">{task.title}</span>
                                  {task.important && <span className="text-[9px] font-black uppercase tracking-widest text-accent-color mt-1 block">{t('Prioritate')}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Science Section */}
                  <details className="group/details bg-bg-card border border-border-color rounded-3xl shadow-sm open:shadow-lg transition-all overflow-hidden cursor-pointer">
                    <summary className="p-6 flex items-center justify-between text-main font-black select-none outline-none">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                          <Info size={20} />
                        </div>
                        <span className="text-lg">{t('Vezi Știința Lunii')} {currentMonthGuide.title}</span>
                      </div>
                      <ChevronRight size={20} className="text-text-secondary transition-transform group-open/details:rotate-90" />
                    </summary>
                    <div className="p-6 pt-0 border-t border-border-color/50 mt-2 bg-bg-main/30">
                      <h4 className="text-xs font-black uppercase text-blue-500 tracking-widest mb-4 mt-4">{t('De ce facem aceste lucrări?')}</h4>
                      <p className="text-sm text-text-secondary font-medium leading-relaxed">
                        {currentMonthGuide.science}
                      </p>
                    </div>
                  </details>
              </div>
           ) : (
              <div className="flex flex-col items-center justify-center py-40 text-center opacity-20">
                 <Wind size={64} className="mb-6 animate-pulse" />
                 <p className="text-xl font-black uppercase tracking-[0.5em]">Loading Elite Content...</p>
              </div>
           )}
        </div>

        {/* Right: Personal Schedule & Quick Tips */}
        <div className="lg:col-span-4 space-y-8">
           <div className="stihl-card p-8 rounded-[2.5rem] bg-bg-card border border-border-color shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-accent-color/5 rounded-bl-full -z-10 blur-3xl"></div>
              <div className="flex items-center justify-between mb-8">
                 <h2 className="text-xs font-black text-main uppercase tracking-[0.3em] flex items-center gap-3">
                    <Clock size={18} className="text-accent-color" />
                    {t('Schedule')}
                 </h2>
                 <span className="text-[11px] font-black text-accent-color uppercase bg-accent-color/10 px-3 py-1 rounded-full border border-accent-color/20">
                    {gardenTasks.length} {t('Tasks')}
                 </span>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {gardenTasks.length > 0 ? gardenTasks
                  .sort((a,b) => {
                    const dateA = a.nextDue?.toDate ? a.nextDue.toDate() : new Date(a.nextDue);
                    const dateB = b.nextDue?.toDate ? b.nextDue.toDate() : new Date(b.nextDue);
                    return dateA.getTime() - dateB.getTime();
                  })
                  .map(task => {
                  const Icon = categoryIcons[task.category as keyof typeof categoryIcons] || PlusCircle;
                  const colorClass = categoryColors[task.category as keyof typeof categoryColors] || categoryColors.other;
                  const dueDate = task.nextDue?.toDate ? task.nextDue.toDate() : new Date(task.nextDue);
                  const isLate = isAfter(new Date(), dueDate) && !isToday(dueDate);

                  return (
                    <div key={task.id} className="group bg-bg-main/40 border border-border-color/40 rounded-2xl p-4 hover:border-accent-color/30 hover:bg-white transition-all flex items-center gap-4 shadow-sm">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClass} shrink-0 transition-transform group-hover:scale-110`}>
                        <Icon size={20} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-main text-[13px] truncate uppercase tracking-tight mb-1">{task.title}</h4>
                        <div className="flex items-center gap-3">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${isLate ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-text-secondary bg-bg-card border-border-color/30'}`}>
                            {isToday(dueDate) ? t('Today') : format(dueDate, 'dd MMM')}
                          </span>
                          <span className="text-[8px] font-bold text-text-secondary uppercase opacity-50 flex items-center gap-1">
                             {t(task.frequency)}
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => setTaskToComplete(task)}
                        className="w-10 h-10 rounded-xl bg-accent-color text-white flex items-center justify-center hover:scale-110 hover:shadow-lg hover:shadow-accent-color/30 transition-all shadow-md active:scale-95"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    </div>
                  );
                }) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center opacity-30">
                    <Wind size={40} className="mx-auto mb-4" />
                    <p className="text-[11px] font-black uppercase tracking-[0.3em]">{t('No schedule found')}</p>
                  </div>
                )}
              </div>
           </div>

           <div className="stihl-card p-8 rounded-[2.5rem] bg-gradient-to-br from-bg-card to-bg-main border border-border-color shadow-xl overflow-hidden">
              <h3 className="text-[11px] font-black text-text-secondary uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                 <Star size={14} className="text-accent-color" />
                 {t('Elite Quick Tips')}
              </h3>
              <div className="space-y-6">
                 <div className="p-5 rounded-2xl bg-white/50 dark:bg-black/20 border border-white hover:border-blue-500/20 transition-all group shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mb-3 group-hover:scale-110 transition-transform">
                      <Droplets size={16} />
                    </div>
                    <p className="text-[11px] font-bold leading-relaxed text-text-secondary opacity-80">{t('Deep irrigation: Target 2.5cm of water per week for structural root depth.')}</p>
                 </div>
                 <div className="p-5 rounded-2xl bg-white/50 dark:bg-black/20 border border-white hover:border-accent-color/20 transition-all group shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-accent-color/10 flex items-center justify-center text-accent-color mb-3 group-hover:scale-110 transition-transform">
                      <Scissors size={16} />
                    </div>
                    <p className="text-[11px] font-bold leading-relaxed text-text-secondary opacity-80">{t('Blade Maintenance: Sharpen blades every 25 hours of use to prevent tissue tearing.')}</p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setShowAddModal(false)}></div>
          <div className="stihl-card w-full max-w-md bg-bg-card rounded-[2.5rem] p-10 relative animate-in zoom-in slide-in-from-bottom-8 duration-500 shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-color/10 rounded-bl-full -z-10 blur-3xl"></div>
            
            <div className="flex items-center justify-between mb-10">
              <div>
                 <h2 className="text-3xl font-black text-main uppercase tracking-tighter">{t('Elite')}</h2>
                 <p className="text-[11px] font-black text-accent-color uppercase tracking-[0.3em]">Protocol Entry</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 flex items-center justify-center bg-bg-main rounded-2xl hover:bg-red-500 hover:text-white transition-all group">
                <Plus size={20} className="rotate-45 group-hover:scale-110 transition-transform" />
              </button>
            </div>
            
            <form onSubmit={handleAddTask} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest ml-1">{t('Activity Date')}</label>
                  <input
                    type="date"
                    value={newTask.nextDueDate || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setNewTask(prev => ({
                        ...prev,
                        nextDueDate: val,
                        title: prev.title || t('Garden Maintenance'),
                        propertyId: properties.length > 0 ? properties[0].id : '',
                        category: 'other',
                        frequency: 'one-time'
                      }));
                    }}
                    className="w-full bg-bg-main border border-border-color rounded-2xl px-5 py-4 text-sm font-bold text-main outline-none focus:border-accent-color transition-all appearance-none shadow-inner"
                    required
                  />
                </div>
                <p className="text-[11px] text-text-secondary italic px-2">
                  {t('This activity will be recorded in your Garden Journal.')}
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-accent-color text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 shadow-2xl shadow-accent-color/30 hover:bg-accent-color-hover hover:scale-[1.02] active:scale-95 transition-all mt-4"
              >
                {isSubmitting ? t('Committing...') : t('Log to Journal')}
                <CheckCircle2 size={20} />
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Complete Task Modal */}
      {taskToComplete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setTaskToComplete(null)}></div>
          <div className="stihl-card w-full max-w-md bg-bg-card rounded-[2.5rem] p-10 relative animate-in zoom-in slide-in-from-bottom-8 duration-500 shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-color/10 rounded-bl-full -z-10 blur-3xl"></div>
            
            <div className="flex items-center justify-between mb-8">
              <div>
                 <h2 className="text-3xl font-black text-main uppercase tracking-tighter">{t('Complete')}</h2>
                 <p className="text-[11px] font-black text-accent-color uppercase tracking-[0.3em]">{taskToComplete.title}</p>
              </div>
              <button onClick={() => setTaskToComplete(null)} className="w-10 h-10 flex items-center justify-center bg-bg-main rounded-2xl hover:bg-red-500 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCompleteTaskConfirm} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest ml-1">{t('Notes (Optional)')}</label>
                <textarea 
                  value={completionNote}
                  onChange={e => setCompletionNote(e.target.value)}
                  className="w-full bg-bg-main border border-border-color rounded-2xl px-5 py-4 text-sm font-bold text-main outline-none focus:border-accent-color transition-all shadow-inner min-h-[100px]"
                  placeholder={t('Add notes for your garden journal...')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest ml-1">{t('Photo (Optional)')}</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-bg-main border-border-color hover:border-accent-color transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Camera className="w-8 h-8 mb-3 text-text-secondary" />
                      <p className="mb-2 text-sm text-text-secondary font-bold">
                        {completionPhoto ? completionPhoto.name : t('Click to upload a photo')}
                      </p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={e => setCompletionPhoto(e.target.files ? e.target.files[0] : null)}
                    />
                  </label>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-accent-color text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 shadow-2xl shadow-accent-color/30 hover:bg-accent-color active:scale-95 transition-all mt-4"
              >
                {isSubmitting ? t('Saving...') : t('Save to Journal')}
                <CheckCircle2 size={20} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CareCalendar;
