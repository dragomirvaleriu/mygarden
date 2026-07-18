import React, { useMemo, useState, useEffect } from 'react';
import { Visit, Property, UserProfile, Client, PotentialClient, Page } from '../src/types';
import { useTranslation } from 'react-i18next';
import { format, startOfWeek, addDays, isSameDay, parseISO, isToday, isBefore, startOfDay, subWeeks, addWeeks } from 'date-fns';
import { formatLongDate, parseSafeDate, calculateDaysSinceLastVisit, calculateDaysSinceVisitCompleted } from '../utils/date';
import { ro, enUS, pl, cs } from 'date-fns/locale';
import { db, doc, updateDoc, auth } from '../services/firebase';
import { logger } from '../services/logger';
import LeadCard from './LeadCard';
import { 
  DndContext, 
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapPin, Clock, CheckCircle2, Play, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, EyeOff, Droplets, History, Sun, Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog, CalendarClock, Sprout } from 'lucide-react';
import { isIrrigatingToday } from '../utils/irrigation';
import { useWeather, getWeatherInfo, DailyWeather } from '../hooks/useWeather';

const WeatherIconMap: Record<string, React.ElementType> = {
  Sun, Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog
};

interface WeeklyKanbanProps {
  visits: Visit[];
  properties: Property[];
  clients: Client[];
  onUpdateVisitDate: (visitId: string, newDate: string) => void;
  onEditVisit: (visit: Visit) => void;
  userProfile?: UserProfile;
  workDays?: 'L-V' | 'L-S' | 'L-D';
  onNavigate: (page: Page, id?: string) => void;
  onEditLead: (lead: PotentialClient) => void;
  onDeleteLead: (leadId: string) => void;
  onUpdateLeadNote: (leadId: string, note: string) => void;
  onUpdateLeadStatus: (leadId: string, status: string) => void;
  onOpenLostReason: (leadId: string) => void;
  onClientClick?: (clientId: string, clientName: string, propertyId?: string, propertyName?: string) => void;
  onFertilizerClick?: (clientId: string, propertyId?: string) => void;
}

const SortableVisitCard = ({ 
  visit, 
  property, 
  client, 
  lastVisit, 
  diffDays,
  allVisits,
  onClick,
  onNavigate,
  onEditLead,
  onDeleteLead,
  onUpdateLeadStatus,
  onUpdateLeadNote,
  onOpenLostReason,
  onClientClick,
  onFertilizerClick
}: { 
  visit: Visit, 
  property?: Property, 
  client?: Client, 
  lastVisit?: Visit | null, 
  diffDays: number | null,
  allVisits?: Visit[],
  onClick: () => void,
  onNavigate: (page: Page, id?: string) => void,
  onEditLead: (lead: PotentialClient) => void,
  onDeleteLead: (leadId: string) => void,
  onUpdateLeadStatus: (leadId: string, status: string) => void,
  onUpdateLeadNote: (leadId: string, note: string) => void,
  onOpenLostReason: (leadId: string) => void,
  onClientClick?: (clientId: string, clientName: string, propertyId?: string, propertyName?: string) => void,
  onFertilizerClick?: (clientId: string, propertyId?: string) => void
}) => {
  const isLead = (visit as any).isLead;
  const leadData = (visit as any).leadData;
  const isReschedulableLead = isLead && leadData?.status === 'vizualizat';
  const isReschedulableVisit = !isLead;
  const { t, i18n } = useTranslation();
  const locales: any = { ro, en: enUS, pl, cs };
  const currentLocale = locales[i18n.language] || locales.ro;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: visit.id,
    disabled: (visit.data ? isBefore(startOfDay(parseSafeDate(visit.data)), startOfDay(new Date())) : false) || (isLead && !isReschedulableLead) || visit.status === 'Finalizat'
  });

  const visitDate = parseSafeDate(visit.data || '');
  const isPastVisit = visit.data ? isBefore(startOfDay(visitDate), startOfDay(new Date())) : false;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : (visit.status === 'Finalizat' ? (isPastVisit ? 0.6 : 0.3) : 1),
  };

  if (isLead && leadData) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="mb-2 cursor-grab active:cursor-grabbing"
      >
        <LeadCard
          lead={leadData}
          onNavigate={onNavigate}
          onEdit={onEditLead}
          onDelete={onDeleteLead}
          onUpdateStatus={onUpdateLeadStatus}
          onUpdateNote={onUpdateLeadNote}
          onOpenLostReason={onOpenLostReason}
          canEditNotes={false}
          showScheduledDate={false}
        />
      </div>
    );
  }

  let shouldPulsate = false;
  if (isLead && leadData?.status === 'ofertat' && leadData?.ofertatAt) {
    const ofertatDate = leadData.ofertatAt.toDate ? leadData.ofertatAt.toDate() : new Date(leadData.ofertatAt);
    const diffTime = Math.abs(new Date().getTime() - ofertatDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 7) {
      shouldPulsate = true;
    }
  }

  const statusColors = {
    'Programat': 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300',
    'Activ': 'border-accent-color/50 bg-accent-color/10 text-accent-color',
    'Finalizat': 'border-green-500/30 bg-green-50/50 dark:bg-green-900/10 text-green-700 dark:text-green-300',
    'Anulat': 'border-red-500/30 bg-red-50/50 dark:bg-red-900/10 text-red-700 dark:text-red-300',
  };

  let statusColor = statusColors[visit.status] || statusColors['Programat'];
  if (isLead) {
    statusColor = 'border-accent-color/20 bg-lead-accent text-purple-700 dark:text-purple-400';
  }

  // diffDays is passed as a prop calculated using the unified helper function

  const companyName = client?.tip_persoana === 'PJ' ? client.numeFirma : '';
  const contactName = client?.nume || visit.clientName || t('Unknown Client');
  const displayName = companyName ? `${companyName} (${contactName})` : contactName;

  const effectiveFertDate = useMemo(() => {
    let date = property?.lastSolidFertilizerDate || client?.lastSolidFertilizerDate;
    if (!client) return date;
    const clientVisits = allVisits?.filter(v => v.clientId === client.id) || [];
    const fertVisits = clientVisits.filter(v => 
      v.status === 'Finalizat' && 
      v.servicii_efectuate?.some(s => {
        const n = (s.name || '').toLowerCase();
        return n.includes('îngrășământ') || n.includes('ingrasamant') || n.includes('fertiliz');
      })
    ).sort((a, b) => parseSafeDate(b.data).getTime() - parseSafeDate(a.data).getTime());
    
    if (fertVisits.length > 0 && fertVisits[0].data) {
      if (!date || parseSafeDate(fertVisits[0].data).getTime() > parseSafeDate(date).getTime()) {
        date = fertVisits[0].data;
      }
    }
    return date;
  }, [property?.lastSolidFertilizerDate, client, allVisits]);

  const isFertilizerActive = !!effectiveFertDate && (Date.now() - new Date(effectiveFertDate).getTime() >= 60 * 24 * 60 * 60 * 1000);

  const isReprogrammed = !!(visit.originalData && visit.data !== visit.originalData);
  const originalDataFormatted = isReprogrammed && visit.originalData 
    ? (() => { try { return format(parseSafeDate(visit.originalData), 'd MMM', { locale: currentLocale }); } catch { return visit.originalData; } })()
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(visit.status === 'Finalizat' ? {} : listeners)}
      onClick={onClick}
      className={`px-3 py-2 mb-2 rounded-xl border ${visit.status === 'Finalizat' ? `border-border-color bg-bg-main/50 ${isPastVisit ? 'opacity-60' : 'opacity-[0.3]'} grayscale` : statusColor} shadow-sm ${visit.status === 'Finalizat' ? 'cursor-default text-text-secondary' : 'cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-bg-card'}`}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <h4 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (isLead) {
                    onEditLead(leadData);
                } else {
                    onNavigate(Page.Details, visit.clientId);
                }
              }}
              className={`font-bold text-sm line-clamp-2 px-1 rounded cursor-pointer hover:text-accent-color hover:underline transition-all ${visit.status === 'Finalizat' ? 'text-text-secondary' : 'text-main'} ${shouldPulsate ? 'animate-pulsate-bg' : ''}`}
            >
              {displayName}
            </h4>
            <button 
              onClick={(e) => { 
                if (onClientClick) {
                  e.stopPropagation(); 
                  onClientClick(visit.clientId, displayName, visit.propertyId, visit.propertyAddress);
                }
              }}
              className="p-1 text-text-secondary hover:text-accent-color hover:bg-accent-color/10 rounded-lg transition-all shrink-0 flex items-center gap-1"
              title={t('Service History')}
            >
              <History size={14} />
              {diffDays !== null && <span className="text-[12.5px] font-bold italic">[{diffDays}z]</span>}
            </button>
          </div>
          {/* Reprogrammed indicator — dynamic derivation from originalData */}
          {isReprogrammed && (
            <div className="inline-block bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider shadow-sm w-fit" title={originalDataFormatted ? `${t('Rescheduled from')} ${originalDataFormatted}` : t('Reprogrammed')}>
                {t('Reprogrammed')}
            </div>
          )}
        </div>
        {isLead && <span className="text-[11px] font-bold uppercase px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 whitespace-nowrap ml-1">{t('Lead')}</span>}
        {visit.status === 'Finalizat' && <CheckCircle2 size={14} className="text-green-500 shrink-0 ml-1" />}
        {visit.status === 'Activ' && <Play size={14} className="text-accent-color shrink-0 ml-1" />}
      </div>
      
      <div className="flex items-center gap-1 text-xs text-text-secondary mb-1">
        <MapPin size={12} className="shrink-0" />
        <span className="truncate">{property?.address || client?.adresa || t('No address')}</span>
        {property?.irrigation && (
          <Droplets 
            size={12} 
            className={isIrrigatingToday(property, visitDate) ? "text-blue-500 shrink-0" : "text-gray-300 shrink-0"} 
          />
        )}
        {isFertilizerActive && (
          <button 
            title={t('Fertilizare necesară (> 2 luni) - Istoric')} 
            className="flex shrink-0 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (onFertilizerClick) onFertilizerClick(visit.clientId, visit.propertyId);
            }}
          >
            <Sprout size={12} className="text-red-500" />
          </button>
        )}
      </div>


      
      {(isLead || visit.status !== 'Programat') && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
            {isLead ? leadData?.status : t(visit.status)}
          </span>
        </div>
      )}
    </div>
  );
};

const DroppableColumn = ({ 
  id, 
  title, 
  date, 
  visits, 
  allVisits, 
  properties, 
  clients, 
  onEditVisit, 
  isPast,
  onNavigate,
  onEditLead,
  onDeleteLead,
  onUpdateLeadStatus,
  onUpdateLeadNote,
  onOpenLostReason,
  onClientClick,
  onFertilizerClick,
  weather
}: { 
  id: string, 
  title: string, 
  date: Date, 
  visits: Visit[], 
  allVisits: Visit[], 
  properties: Property[], 
  clients: Client[], 
  onEditVisit: (v: Visit) => void, 
  isPast: boolean,
  onNavigate: (page: Page, id?: string) => void,
  onEditLead: (lead: PotentialClient) => void,
  onDeleteLead: (leadId: string) => void,
  onUpdateLeadStatus: (leadId: string, status: string) => void,
  onUpdateLeadNote: (leadId: string, note: string) => void,
  onOpenLostReason: (leadId: string) => void,
  onClientClick?: (clientId: string, clientName: string, propertyId?: string, propertyName?: string) => void,
  onFertilizerClick?: (clientId: string, propertyId?: string) => void,
  weather?: DailyWeather
}) => {
  const isCurrentDay = isToday(date);
  const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
  const { setNodeRef } = useDroppable({ id });
  const { t, i18n } = useTranslation();

  const locales: any = { ro, en: enUS, pl, cs };
  const currentLocale = locales[i18n.language] || locales.ro;

  let headerClasses = 'border-border-color bg-bg-card';
  if (isCurrentDay) {
    headerClasses = 'bg-accent-color/10 border-accent-color/20';
  } else if (isWeekendDay) {
    headerClasses = 'bg-red-50/60 dark:bg-red-900/10 border-border-color';
  }

  const flexWeight = visits.length > 0 ? 1.15 : 0.5;

  return (
    <div 
      ref={setNodeRef} 
      className={`flex flex-col w-full 2xl:w-auto rounded-2xl border ${isCurrentDay ? 'border-2 border-accent-color shadow-lg shadow-accent-color/15' : 'border-border-color'} overflow-hidden min-h-[250px] h-full ${isPast ? 'bg-bg-main/40 opacity-50 grayscale' : 'bg-bg-main'}`}
      style={{
        flexGrow: flexWeight,
        flexShrink: 1,
        flexBasis: '0%',
      }}
    >
      <div className={`p-3 border-b ${headerClasses} flex justify-between items-center sticky top-0 z-10`}>
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${isCurrentDay ? 'bg-accent-color text-white' : 'bg-border-color text-text-secondary'}`}>
            {visits.length}
          </div>
          <h3 className={`font-bold text-sm uppercase tracking-wider flex items-center gap-1.5 ${isCurrentDay ? 'text-accent-color' : isWeekendDay ? 'text-red-500 dark:text-red-400' : 'text-main'}`}>
            {isCurrentDay && (
              <span className="bg-accent-color text-white text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                {t('Today')}
              </span>
            )}
            {title} <span className="opacity-60 normal-case font-bold">{format(date, 'd MMMM', { locale: currentLocale })}</span>
          </h3>
        </div>
        
        {weather && (
          <div className="flex items-center gap-1.5 text-xs font-bold ml-1" title={getWeatherInfo(weather.weatherCode).name}>
            {(() => {
              const info = getWeatherInfo(weather.weatherCode);
              const Icon = WeatherIconMap[info.icon] || Cloud;
              return <Icon size={14} className={`${info.color} shrink-0`} />;
            })()}
            <span className="opacity-80 text-text-secondary">{weather.maxTemp}°C</span>
          </div>
        )}
      </div>
      
      <div className="p-2 flex-1 overflow-y-auto min-h-[150px]">
        <SortableContext id={id} items={visits.map(v => v.id)} strategy={verticalListSortingStrategy}>
          {[...visits].sort((a, b) => {
            if (a.status === 'Finalizat' && b.status !== 'Finalizat') return 1;
            if (a.status !== 'Finalizat' && b.status === 'Finalizat') return -1;
            return 0;
          }).map(visit => {
            const client = clients.find(c => c.id === visit.clientId);
            const lastVisit = allVisits
               .filter(v_item => {
                 if (v_item.clientId !== visit.clientId || v_item.status !== 'Finalizat' || !v_item.data || v_item.id === visit.id) return false;
                 // Allow legacy visits without propertyId
                 if (visit.propertyId && v_item.propertyId && v_item.propertyId !== visit.propertyId) return false;
                 const vItemISO = format(parseSafeDate(v_item.data), 'yyyy-MM-dd');
                 const visitISO = visit.data ? format(parseSafeDate(visit.data), 'yyyy-MM-dd') : '';
                 return vItemISO <= visitISO;
               })
               .sort((a, b) => {
                 const aISO = format(parseSafeDate(a.data), 'yyyy-MM-dd');
                 const bISO = format(parseSafeDate(b.data), 'yyyy-MM-dd');
                 return bISO.localeCompare(aISO);
               })[0];

             const diffDays = visit.status === 'Finalizat'
               ? calculateDaysSinceVisitCompleted(visit)
               : calculateDaysSinceLastVisit(allVisits, visit.clientId, visit.propertyId, visit.id);

            return (
              <SortableVisitCard 
                key={visit.id} 
                visit={visit} 
                property={properties.find(p => p.id === visit.propertyId)}
                client={client}
                lastVisit={lastVisit}
                diffDays={diffDays}
                allVisits={allVisits}
                onClick={() => visit.status === 'Finalizat' ? null : onEditVisit(visit)}
                onNavigate={onNavigate}
                onEditLead={onEditLead}
                onDeleteLead={onDeleteLead}
                onUpdateLeadStatus={onUpdateLeadStatus}
                onUpdateLeadNote={onUpdateLeadNote}
                onOpenLostReason={onOpenLostReason}
                onClientClick={onClientClick}
                onFertilizerClick={onFertilizerClick}
              />
            );
          })}
          {visits.length === 0 && (
            <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-border-color rounded-xl text-text-secondary text-xs p-4 text-center">
              {t('Drop a visit here')}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
};

export const WeeklyKanban: React.FC<WeeklyKanbanProps> = ({ 
  visits, 
  properties, 
  clients, 
  onUpdateVisitDate, 
  onEditVisit, 
  userProfile, 
  workDays = 'L-S',
  onNavigate,
  onEditLead,
  onDeleteLead,
  onUpdateLeadNote,
  onUpdateLeadStatus,
  onOpenLostReason,
  onClientClick,
  onFertilizerClick
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    // Show next week if it's Sunday
    if (now.getDay() === 0) {
      return addWeeks(start, 1);
    }
    return start;
  });
  // Track whether we've already done the auto-jump on first load
  const [hasAutoJumped, setHasAutoJumped] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPastDays, setShowPastDays] = useState(userProfile?.kanbanShowPastDays ?? false);
  const { t, i18n } = useTranslation();

  const locales: any = { ro, en: enUS, pl, cs };
  const currentLocale = locales[i18n.language] || locales.ro;

  useEffect(() => {
    if (userProfile?.kanbanShowPastDays !== undefined) {
      setShowPastDays(userProfile.kanbanShowPastDays);
    }
  }, [userProfile?.kanbanShowPastDays]);

  // Auto-jump to the nearest future week that has active visits,
  // but only once on mount (when visits first load) and only if current week is empty.
  useEffect(() => {
    if (hasAutoJumped || visits.length === 0) return;

    let length = 6;
    if (workDays === 'L-V') length = 5;
    if (workDays === 'L-D') length = 7;

    const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
    const weekEndStr = format(addDays(currentWeekStart, length - 1), 'yyyy-MM-dd');

    // Count active/scheduled visits in the currently displayed week boundaries (L-V, L-S etc)
    const activeInCurrentWeek = visits.filter(v => {
      if (v.status === 'Finalizat' || v.status === 'Anulat') return false;
      const d = v.data ? format(parseSafeDate(v.data), 'yyyy-MM-dd') : '';
      return d >= weekStartStr && d <= weekEndStr;
    });

    if (activeInCurrentWeek.length === 0) {
      // Find the next week (up to 8 weeks ahead) that has at least one active visit
      for (let weeksAhead = 1; weeksAhead <= 8; weeksAhead++) {
        const candidateStart = addWeeks(currentWeekStart, weeksAhead);
        const candidateStartStr = format(candidateStart, 'yyyy-MM-dd');
        const candidateEndStr = format(addDays(candidateStart, length - 1), 'yyyy-MM-dd');

        const hasVisits = visits.some(v => {
          if (v.status === 'Finalizat' || v.status === 'Anulat') return false;
          const d = v.data ? format(parseSafeDate(v.data), 'yyyy-MM-dd') : '';
          return d >= candidateStartStr && d <= candidateEndStr;
        });

        if (hasVisits) {
          setCurrentWeekStart(candidateStart);
          break;
        }
      }
    }

    setHasAutoJumped(true);
  }, [visits, hasAutoJumped, workDays, currentWeekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTogglePastDays = async () => {
    const newValue = !showPastDays;
    setShowPastDays(newValue);
    
    if (auth.currentUser) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          kanbanShowPastDays: newValue
        });
      } catch (error) {
        console.error('Error saving kanban preference:', error);
      }
    }
  };

  const { weather } = useWeather(44.3302, 23.7949); // Craiova coordinates
  
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Generate the days of the week based on workDays setting
  const weekDays = useMemo(() => {
    const today = startOfDay(new Date());
    let length = 6; // Default L-S
    if (workDays === 'L-V') length = 5;
    if (workDays === 'L-D') length = 7;
    
    return Array.from({ length }).map((_, i) => {
      const date = addDays(currentWeekStart, i);
      return {
        id: format(date, 'yyyy-MM-dd'),
        date,
        title: format(date, 'EEE', { locale: currentLocale }).replace('.', ''),
        isPast: isBefore(date, today)
      };
    });
  }, [currentWeekStart, workDays, currentLocale]);

  const visibleDays = useMemo(() => {
    return weekDays.filter(day => showPastDays || !day.isPast);
  }, [weekDays, showPastDays]);

  // Group visits by day
  const visitsByDay = useMemo(() => {
    const grouped: Record<string, Visit[]> = {};
    weekDays.forEach(day => {
      grouped[day.id] = [];
    });

    visits.forEach(visit => {
      const vDateStr = visit.data || "";
      if (vDateStr) {
        const isoDate = format(parseSafeDate(vDateStr), 'yyyy-MM-dd');
        if (grouped[isoDate]) {
          // If showPastDays is false, hide 'Finalizat' visits
          if (!showPastDays && visit.status === 'Finalizat') return;
          grouped[isoDate].push(visit);
        }
      }
    });

    // Sort visits within each day
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const aIsLead = (a as any).isLead;
        const bIsLead = (b as any).isLead;
        if (aIsLead && !bIsLead) return -1;
        if (!aIsLead && bIsLead) return 1;
        return (a.clientName || '').localeCompare(b.clientName || '');
      });
    });

    return grouped;
  }, [visits, weekDays, showPastDays]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const activeVisitId = active.id as string;
    const overId = over.id as string;

    const visit = visits.find(v => v.id === activeVisitId);
    if (!visit) return;

    let targetDate = overId;
    
    if (!weekDays.find(d => d.id === overId)) {
      const targetVisit = visits.find(v => v.id === overId);
      if (targetVisit && targetVisit.data) {
        targetDate = targetVisit.data;
      } else {
        const containerId = over.data?.current?.sortable?.containerId;
        if (containerId) {
          targetDate = containerId;
        }
      }
    }

    const currentVisitDateISO = visit.data ? format(parseSafeDate(visit.data), 'yyyy-MM-dd') : '';

    if (targetDate && currentVisitDateISO !== targetDate && weekDays.find(d => d.id === targetDate)) {
      const targetDay = weekDays.find(d => d.id === targetDate);
      if (targetDay && targetDay.isPast) {
        return; 
      }

      if ((visit as any).isLead && (visit as any).leadData?.status !== 'vizualizat') {
        logger.log(t('Only "To see" leads can be rescheduled'), "warn");
        return;
      }

      onUpdateVisitDate(activeVisitId, targetDate);
    }
  };

  const activeVisit = useMemo(() => {
    return activeId ? visits.find(v => v.id === activeId) : null;
  }, [activeId, visits]);

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-bg-card p-3 rounded-2xl border border-border-color shadow-sm gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon size={20} className="text-accent-color" />
          <h2 className="font-bold text-main capitalize">
            {format(currentWeekStart, 'MMMM yyyy', { locale: currentLocale })}
          </h2>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={handleTogglePastDays}
            title={showPastDays ? t('Hide past visits') : t('Show past visits')}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-bg-main hover:bg-border-color transition-colors text-text-secondary mr-2"
          >
            {showPastDays ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentWeekStart(prev => addDays(prev, -7))}
              className="p-2 rounded-xl hover:bg-bg-main text-text-secondary transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-bg-main hover:bg-border-color transition-colors text-main"
            >
              {t('Today')}
            </button>
            <button 
              onClick={() => setCurrentWeekStart(prev => addDays(prev, 7))}
              className="p-2 rounded-xl hover:bg-bg-main text-text-secondary transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 pb-4">
        <DndContext 
          sensors={sensors} 
          collisionDetection={pointerWithin} 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:flex 2xl:flex-row gap-4">
            {visibleDays.map(day => (
              <DroppableColumn 
                key={day.id}
                id={day.id}
                title={day.title}
                date={day.date}
                isPast={day.isPast}
                visits={visitsByDay[day.id] || []}
                allVisits={visits}
                properties={properties}
                clients={clients}
                onEditVisit={onEditVisit}
                onNavigate={onNavigate}
                onEditLead={onEditLead}
                onDeleteLead={onDeleteLead}
                onUpdateLeadStatus={onUpdateLeadStatus}
                onUpdateLeadNote={onUpdateLeadNote}
                onOpenLostReason={onOpenLostReason}
                onClientClick={onClientClick}
                onFertilizerClick={onFertilizerClick}
                weather={weather[day.id]}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={dropAnimation}>
            {activeVisit ? (
              <SortableVisitCard 
                visit={activeVisit} 
                property={properties.find(p => p.id === activeVisit.propertyId)}
                client={clients.find(c => c.id === activeVisit.clientId)}
                lastVisit={visits
                  .filter(v_item => v_item.clientId === activeVisit.clientId && v_item.status === 'Finalizat' && v_item.data && v_item.data <= (activeVisit.data || '') && v_item.id !== activeVisit.id && (!activeVisit.propertyId || v_item.propertyId === activeVisit.propertyId))
                  .sort((a, b) => b.data.localeCompare(a.data))[0]}
                 diffDays={activeVisit.status === 'Finalizat'
                   ? calculateDaysSinceVisitCompleted(activeVisit)
                   : calculateDaysSinceLastVisit(visits, activeVisit.clientId, activeVisit.propertyId, activeVisit.id)}
                onClick={() => {}}
                onNavigate={onNavigate}
                onEditLead={onEditLead}
                onDeleteLead={onDeleteLead}
                onUpdateLeadStatus={onUpdateLeadStatus}
                onUpdateLeadNote={onUpdateLeadNote}
                onOpenLostReason={onOpenLostReason}
                onClientClick={onClientClick}
                onFertilizerClick={onFertilizerClick}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default WeeklyKanban;
