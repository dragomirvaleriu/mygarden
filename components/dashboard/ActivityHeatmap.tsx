import React from 'react';
import { ro, enUS } from 'date-fns/locale';
import { parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { Visit, Client, Property } from '../../src/types';

export const ActivityHeatmap: React.FC<{ visits: Visit[] }> = ({ visits }) => {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === 'ro' ? ro : enUS;
  const [weeks, setWeeks] = React.useState(12);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateWeeks = () => {
      if (containerRef.current) {
        const available = containerRef.current.clientWidth - 40; // 40px for labels
        const calcWeeks = Math.max(4, Math.floor(available / 20)); // 20px per week column
        setWeeks(calcWeeks);
      }
    };
    // Initial calculate after render
    setTimeout(updateWeeks, 10);
    window.addEventListener('resize', updateWeeks);
    return () => window.removeEventListener('resize', updateWeeks);
  }, []);
  const [hoveredDay, setHoveredDay] = React.useState<any>(null);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };
  
  const cellData = React.useMemo(() => {
    const map: Record<string, { count: number; visits: { clientName: string }[] }> = {};
    visits.filter(v => v.status === 'Finalizat').forEach(v => {
      const vDate = v.completedAt ? format(v.completedAt.toDate(), 'yyyy-MM-dd') : v.data;
      if (!vDate) return;

      if (!map[vDate]) {
        map[vDate] = { count: 0, visits: [] };
      }
      map[vDate].count += 1;
      map[vDate].visits.push({ clientName: v.clientName || 'Client' });
    });
    return map;
  }, [visits]);

  const maxVisits = Math.max(1, ...Object.values(cellData).map(d => d.count));
  
  const days = React.useMemo(() => {
    const list = [];
    const today = new Date();
    // End on the Sunday of the current week (or use Monday as base)
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    // If weeks = 12, we want to go back 11 weeks from the start of the current week
    const startDate = addDays(currentWeekStart, -(weeks - 1) * 7);
    
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(startDate, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      
      // Calculate week of month manually for better control
      const firstDayOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      const dayOfMonth = d.getDate();
      // Adjust week calculation for Monday-based weeks
      const weekOfMonth = Math.ceil((dayOfMonth + (firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1)) / 7);

      list.push({ 
        dateStr, 
        count: cellData[dateStr]?.count || 0,
        visitDetails: cellData[dateStr]?.visits || [],
        dayOfWeek: d.getDay(),
        month: format(d, 'MMM', { locale: currentLocale }),
        weekOfMonth,
        isFirstInMonth: i === 0 || d.getDate() === 1 || (i % 7 === 0 && d.getMonth() !== addDays(d, -7).getMonth())
      });
    }
    return list;
  }, [cellData, weeks, currentLocale]);

  const getColorValue = (count: number) => {
    if (count === 0) return 'var(--heatmap-bg-empty)';
    const intensity = count / maxVisits;
    
    // 6 Intensity levels
    if (intensity < 0.16) return 'var(--heatmap-bg-l1)';
    if (intensity < 0.33) return 'var(--heatmap-bg-l2)';
    if (intensity < 0.5) return 'var(--heatmap-bg-l3)';
    if (intensity < 0.66) return 'var(--heatmap-bg-l4)';
    if (intensity < 0.83) return 'var(--heatmap-bg-l5)';
    return 'var(--heatmap-bg-l6)';
  };

  const byWeek: any[][] = [];
  for (let w = 0; w < weeks; w++) byWeek.push(days.slice(w * 7, (w + 1) * 7));
  byWeek.reverse(); // Display weeks in descending chronological order (most recent on the left)

  // Find which weekdays have at least one visit
  const activeWeekdays = React.useMemo(() => {
    const active = new Set<number>();
    days.forEach(day => {
      if (day.count > 0) {
        active.add(day.dayOfWeek);
      }
    });
    // Fallback: if no active days at all, show everything
    if (active.size === 0) {
      return new Set([1, 2, 3, 4, 5, 6, 0]);
    }
    return active;
  }, [days]);

  // Define all day labels mapped to their weekday index (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const allDayLabels = React.useMemo(() => {
    return i18n.language === 'ro' 
      ? [
          { label: 'D', dayOfWeek: 0 },
          { label: 'S', dayOfWeek: 6 },
          { label: 'V', dayOfWeek: 5 },
          { label: 'J', dayOfWeek: 4 },
          { label: 'M', dayOfWeek: 3 },
          { label: 'M', dayOfWeek: 2 },
          { label: 'L', dayOfWeek: 1 },
        ]
      : [
          { label: 'S', dayOfWeek: 0 },
          { label: 'S', dayOfWeek: 6 },
          { label: 'F', dayOfWeek: 5 },
          { label: 'T', dayOfWeek: 4 },
          { label: 'W', dayOfWeek: 3 },
          { label: 'T', dayOfWeek: 2 },
          { label: 'M', dayOfWeek: 1 },
        ];
  }, [i18n.language]);

  const activeDayLabels = React.useMemo(() => {
    return allDayLabels.filter(item => activeWeekdays.has(item.dayOfWeek));
  }, [allDayLabels, activeWeekdays]);

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <div className="flex gap-4">
        {/* Day Labels Column */}
        <div className="flex flex-col gap-1 pr-1 pt-7">
          {activeDayLabels.map((item, i) => (
            <span key={i} className="text-[7px] font-black text-text-secondary h-4 flex items-center opacity-40 uppercase">{item.label}</span>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto scrollbar-hide">
          {/* Months & Weeks Row */}
          <div className="flex gap-1 mb-1">
             {(() => {
               const announced = new Set();
               return byWeek.map((week, wi) => {
                 const monthToAnnounce = week.find(d => !announced.has(d.month))?.month;
                 const showThisMonth = monthToAnnounce;
                 if (monthToAnnounce) announced.add(monthToAnnounce);
                 
                 return (
                   <div key={wi} className="w-4 flex flex-col gap-0.5">
                     <div className="h-3 text-[7px] font-black text-text-secondary uppercase opacity-60">
                       {showThisMonth || ''}
                     </div>
                     <div className="h-3 text-[8px] font-black text-accent-color/60 text-center">
                       {week[0].weekOfMonth}
                     </div>
                   </div>
                 );
               });
             })()}
          </div>

          <div className="flex gap-1 pb-2">
            {byWeek.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                 {/* Reverse render the week days to match descending Sunday-to-Monday order */}
                 {week.slice().reverse().filter(day => activeWeekdays.has(day.dayOfWeek)).map(day => (
                  <div key={day.dateStr} 
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onMouseMove={handleMouseMove}
                    className="w-4 h-4 rounded-sm transition-all hover:scale-110 cursor-default border border-border-color/5 group relative"
                    style={{ backgroundColor: getColorValue(day.count) }}>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {hoveredDay && (
        <div className="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-[calc(100%+12px)] flex flex-col items-center"
             style={{ left: mousePos.x, top: mousePos.y }}>
          <div className="bg-bg-card border border-border-color p-3 rounded-xl shadow-2xl text-[11px] font-black uppercase max-w-[280px] animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-1.5 border-b border-border-color/30 pb-1 gap-4">
               <span className="text-accent-color">
                 {format(parseISO(hoveredDay.dateStr), 'eeee d MMM', { locale: currentLocale }).replace(/^\w/, c => c.toUpperCase())}
               </span>
               <span className="text-main">
                 {hoveredDay.count} {hoveredDay.count === 1 ? t('visit') : t('visits')}
               </span>
             </div>
             {hoveredDay.visitDetails && hoveredDay.visitDetails.length > 0 && (
               <div className="space-y-1 font-bold normal-case text-text-secondary text-[10px]">
                 {hoveredDay.visitDetails.map((v: any, idx: number) => (
                   <div key={idx} className="truncate max-w-[200px]">• {v.clientName}</div>
                 ))}
               </div>
             )}
          </div>
          <div className="w-2 h-2 bg-bg-card border-r border-b border-border-color rotate-45 -mt-1.5 shadow-sm"></div>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 border-t border-border-color/30 pt-3">
        <p className="text-[8px] font-black text-text-secondary uppercase tracking-widest opacity-60">
          {t('Activity Density (Visits/Day)')}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-secondary font-bold">{t('Less')}</span>
          {[0, 0.16, 0.33, 0.5, 0.66, 0.83, 1].map(i => (
            <div 
              key={i} 
              className="w-3 h-3 rounded-sm border border-border-color/5" 
              style={{ backgroundColor: getColorValue(Math.ceil(i * maxVisits)) }} 
            />
          ))}
          <span className="text-[11px] text-text-secondary font-bold">{t('More')}</span>
        </div>
      </div>
    </div>
  );
};
