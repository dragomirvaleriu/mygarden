
import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { format, isSameDay } from 'date-fns';
import { Visit, Client } from '../../src/types';
import { VisitCompactCard } from './VisitCompactCard';
import { EmptyState } from '../EmptyState';
import { useTranslation } from 'react-i18next';
import { resolveAndParseMapsLink } from '../../utils/maps';
import { optimizeRouteNearestNeighbor } from '../../utils/routeUtils';
import { MapPin, Loader2 } from 'lucide-react';

interface Props {
  days: Date[];
  visits: Visit[];
  clients: Client[];
  currentLocale: any;
  onEditVisit: (visit: Visit) => void;
  onClientClick: (clientId: string, clientName: string, propertyId?: string, propertyName?: string) => void;
  organization?: any;
}

export const AgendaView: React.FC<Props> = ({ days, visits, clients, currentLocale, onEditVisit, onClientClick, organization }) => {
  const { t } = useTranslation();
  const [optimizedOrder, setOptimizedOrder] = React.useState<Record<string, string[]>>({});
  const [optimizingDate, setOptimizingDate] = React.useState<string | null>(null);

  const handleOptimize = async (dateStr: string, dayVisits: Visit[]) => {
    setOptimizingDate(dateStr);
    try {
      const points: {id: string, lat: number, lng: number}[] = [];
      for (const v of dayVisits) {
        const leadMapsLink = (v as any).leadData?.mapsLink || (v as any).mapsLink;
        const linkSource = v.propertyMapsLink || leadMapsLink || v.propertyAddress || v.clientAddress;
        
        if (linkSource) {
           const coords = await resolveAndParseMapsLink(linkSource);
           if (coords) {
             points.push({ id: v.id, lat: coords.lat, lng: coords.lng });
           }
        }
      }
      
      let startCoords = points.length > 0 ? { lat: points[0].lat, lng: points[0].lng } : null;
      
      if (navigator.geolocation) {
          try {
             const pos: GeolocationPosition = await new Promise((resolve, reject) => {
                 navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
             });
             startCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          } catch(e) {}
      }

      let hqCoords: { lat: number; lng: number } | null = null;
      if (organization) {
        const hqSource = organization.mapsLink || organization.address;
        if (hqSource) {
          try {
            hqCoords = await resolveAndParseMapsLink(hqSource);
          } catch (err) {
            console.error("Error resolving HQ coords:", err);
          }
        }
      }

      if (startCoords && points.length > 1) {
         const route = optimizeRouteNearestNeighbor(startCoords, points, hqCoords);
         const order = route.map(r => r.id);
         const unmapped = dayVisits.filter(v => !order.includes(v.id)).map(v => v.id);
         setOptimizedOrder(prev => ({ ...prev, [dateStr]: [...order, ...unmapped] }));
      }
    } catch(e) {
      console.error("Optimization failed", e);
    } finally {
      setOptimizingDate(null);
    }
  };

  if (days.length === 0) {
    return (
      <EmptyState 
        title={t('No schedule found')} 
        description={t('Try adjusting your filters or date range.')} 
        type="schedule" 
      />
    );
  }

  return (
    <Virtuoso
      useWindowScroll
      data={days}
      itemContent={(index, day) => {
        const isToday = isSameDay(day, new Date());
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayVisits = visits.filter(v => v.data === dayStr);

        return (
          <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
            <div 
              className={`min-h-[120px] border rounded-3xl p-6 flex flex-col md:flex-row gap-6 transition-all ${
                isToday 
                  ? 'border-accent-color bg-accent-color/5 shadow-lg shadow-accent-color/5' 
                  : 'border-border-color bg-bg-card/50'
              }`}
            >
              <div className={`flex flex-col justify-center items-center md:w-32 pb-4 md:pb-0 border-b md:border-b-0 md:border-r ${isToday ? 'border-accent-color/20' : 'border-border-color/50'}`}>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-color mb-1 opacity-60">
                  {format(day, 'EEEE', { locale: currentLocale })}
                </div>
                <div className="text-5xl font-black tracking-tighter text-accent-color">
                  {format(day, 'd')}
                </div>
                <div className="text-[11px] font-bold text-text-secondary mt-1 opacity-40">
                  {format(day, 'MMM yyyy', { locale: currentLocale })}
                </div>
                {dayVisits.length > 1 && (
                    <button 
                      onClick={() => handleOptimize(dayStr, dayVisits)}
                      disabled={optimizingDate === dayStr}
                      className="mt-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors whitespace-nowrap"
                    >
                      {optimizingDate === dayStr ? (
                        <><Loader2 size={10} className="animate-spin" /> {t('Se calculează...')}</>
                      ) : (
                        <><MapPin size={10} /> {optimizedOrder[dayStr] ? t('Re-optimizează') : t('Optimizează')}</>
                      )}
                    </button>
                )}
              </div>
              
              <div className="flex-1 flex flex-row flex-wrap gap-3 items-start content-start">
                {dayVisits.length === 0 ? (
                  <div className="flex items-center justify-center h-full w-full py-8 text-text-secondary opacity-30 text-[11px] font-black uppercase tracking-widest">
                    {t('No visits scheduled')}
                  </div>
                ) : (
                  (() => {
                    const orderedVisits = optimizedOrder[dayStr] 
                      ? [...dayVisits].sort((a, b) => optimizedOrder[dayStr].indexOf(a.id) - optimizedOrder[dayStr].indexOf(b.id))
                      : dayVisits;
                    return orderedVisits.map(visit => (
                    <VisitCompactCard 
                      key={visit.id}
                      visit={visit}
                      allVisits={visits}
                      client={clients.find(c => c.id === visit.clientId)}
                      isPast={visit.status === 'Finalizat'}
                      onClick={onEditVisit}
                      onClientClick={onClientClick}
                    />
                  ));
                  })()
                )}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
};
