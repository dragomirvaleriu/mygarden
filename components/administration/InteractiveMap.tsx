import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { db, collection, query, where, getDocs } from '../../services/firebase';
import { Visit, Property, Client } from '../../src/types';
import MapView from '../MapView';
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
import { Map as MapIcon, Calendar, CheckCircle2 } from 'lucide-react';

interface Props {
  organizationId: string;
}

const InteractiveMap: React.FC<Props> = ({ organizationId }) => {
  const { t } = useTranslation();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const weekRange = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    return { start, end };
  }, []);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!organizationId) return;
      setLoading(true);
      try {
        const vQ = query(
          collection(db, 'visits'),
          where('organizationId', '==', organizationId)
        );
        const vSnap = await getDocs(vQ);
        const startStr = format(weekRange.start, 'yyyy-MM-dd');
        const endStr = format(weekRange.end, 'yyyy-MM-dd');
        
        const allVisits = vSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() })) as Visit[];
          
        const filteredVisits = allVisits.filter(v => v.data >= startStr && v.data <= endStr);
        setVisits(filteredVisits);

        const pQ = query(
          collection(db, 'properties'),
          where('organizationId', '==', organizationId)
        );
        const pSnap = await getDocs(pQ);
        setProperties(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Property[]);

        const cQ = query(
          collection(db, 'clients'),
          where('organizationId', '==', organizationId)
        );
        const cSnap = await getDocs(cQ);
        setClients(cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[]);

      } catch (error) {
        console.error("Error fetching map data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [organizationId, weekRange]);

  const stats = useMemo(() => {
    const total = visits.length;
    const scheduled = visits.filter(v => (v.status || 'Programat') === 'Programat').length;
    const inProgress = visits.filter(v => v.status === 'Activ').length;
    const completed = visits.filter(v => v.status === 'Finalizat').length;

    return {
      total,
      scheduled,
      inProgress,
      completed,
      scheduledPct: total > 0 ? (scheduled / total) * 100 : 0,
      inProgressPct: total > 0 ? (inProgress / total) * 100 : 0,
      completedPct: total > 0 ? (completed / total) * 100 : 0
    };
  }, [visits]);

  const mapMarkers = useMemo(() => {
    return visits.map(v => {
        let lat = v.latitude;
        let lng = v.longitude;

        if (!lat || !lng) {
          const prop = properties.find(p => p.id === v.propertyId);
          if (prop && prop.latitude && prop.longitude) {
            lat = prop.latitude;
            lng = prop.longitude;
          }
        }

        if (!lat || !lng) {
          const client = clients.find(c => c.id === v.clientId);
          if (client && client.latitude && client.longitude) {
            lat = client.latitude;
            lng = client.longitude;
          }
        }

        if (!lat || !lng) return null;

        let color = '#3b82f6'; 
        if (v.status === 'Finalizat') color = '#22c55e';
        else if (v.status === 'Activ') color = '#f07d00';
        else if (v.status === 'Anulat') color = '#ef4444';
        
        return {
          id: v.id,
          lat,
          lng,
          title: v.clientName || 'Vizită',
          label: v.clientName || 'Vizită',
          color,
          details: `${v.tipLucrare || 'Mentenanță'} - ${v.data ? format(parseISO(v.data), 'dd/MM') : '?'}`
        };
      }).filter(Boolean) as any[];
  }, [visits, properties, clients]);

  const LegendItem = ({ label, count, pct, color, animate = false }: { label: string, count: number, pct: number, color: string, animate?: boolean }) => (
    <div className="flex flex-col gap-1 w-full sm:w-[170px]">
        {/* Pastila style - battery background */}
        <div className="h-10 w-full bg-sky-300/30 rounded-xl border border-sky-400/50 overflow-hidden relative shadow-sm">
            {/* Darker fill representing "battery charge" */}
            <div 
                className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${animate ? 'animate-pulse' : ''}`}
                style={{ 
                    width: `${pct}%`, 
                    backgroundColor: color,
                    opacity: 0.25
                }}
            />
            {/* Thick line indicator at bottom */}
            <div 
                className="absolute bottom-0 left-0 h-[4px] transition-all duration-1000 ease-out"
                style={{ 
                    width: `${pct}%`, 
                    backgroundColor: color 
                }}
            />
            {/* Content inside the pill */}
            <div className="absolute inset-0 flex items-center justify-between px-3 z-10">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className={`w-3 h-3 rounded-full shrink-0 shadow-sm ${animate ? 'animate-pulse' : ''}`} style={{ backgroundColor: color }} />
                    <span className="text-[11px] font-black uppercase text-main truncate tracking-normal" style={{ color: color }}>{label}</span>
                </div>
                <span className="text-[12px] font-black ml-1" style={{ color: color }}>{count}</span>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-main flex items-center gap-2 uppercase tracking-tight">
            <MapIcon className="text-accent-color" />
            {t('Interactive Map')}
          </h3>
          <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mt-1">
            {format(weekRange.start, 'dd MMM')} - {format(weekRange.end, 'dd MMM yyyy')}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-row sm:gap-4 sm:w-auto">
          <LegendItem 
            label={t('Upcoming_status')} 
            count={stats.scheduled} 
            pct={stats.scheduledPct} 
            color="#2563eb" // Deeper Blue for visibility
          />
          <LegendItem 
            label={t('Completed_status')} 
            count={stats.completed} 
            pct={stats.completedPct} 
            color="#16a34a" // Deeper Green
          />
        </div>
      </div>

      <div className="stihl-card rounded-3xl overflow-hidden h-[600px] border border-border-color shadow-2xl relative touch-pan-prevention">
        {loading ? (
            <div className="absolute inset-0 bg-bg-card/50 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-accent-color/20 border-t-accent-color rounded-full animate-spin"></div>
                    <p className="text-xs font-black uppercase tracking-widest text-text-secondary">{t('Loading Map Data...')}</p>
                </div>
            </div>
        ) : visits.length === 0 ? (
            <div className="absolute inset-0 bg-bg-card flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 bg-bg-main rounded-full flex items-center justify-center mb-4 border border-border-color shadow-inner">
                    <Calendar size={40} className="text-text-secondary opacity-20" />
                </div>
                <h4 className="text-lg font-black text-main uppercase mb-2">{t('No visits this week')}</h4>
                <p className="text-sm text-text-secondary max-w-xs">{t('Schedule visits in the calendar to see them here.')}</p>
            </div>
        ) : mapMarkers.length === 0 ? (
            <div className="absolute inset-0 bg-bg-card flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 bg-bg-main rounded-full flex items-center justify-center mb-4 border border-border-color shadow-inner">
                    <MapIcon size={40} className="text-text-secondary opacity-20" />
                </div>
                <h4 className="text-lg font-black text-main uppercase mb-2">{t('No Locations Found')}</h4>
                <p className="text-sm text-text-secondary max-w-xs">{t('Visits are scheduled, but clients lack GPS coordinates.')}</p>
            </div>
        ) : (
            <TwoFingerMapWrapper>
              <MapView 
                  center={mapMarkers.length > 0 ? { lat: mapMarkers[0].lat, lng: mapMarkers[0].lng } : undefined}
                  zoom={12}
                  markers={mapMarkers}
              />
            </TwoFingerMapWrapper>
        )}
      </div>
    </div>
  );
};

// Wrapper that intercepts touch events and blocks single-touch map interactions
const TwoFingerMapWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prevent = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    el.addEventListener('touchstart', prevent, { passive: false, capture: true });
    el.addEventListener('touchmove', prevent, { passive: false, capture: true });

    return () => {
      el.removeEventListener('touchstart', prevent, { capture: true });
      el.removeEventListener('touchmove', prevent, { capture: true });
    };
  }, []);

  return <div ref={ref} style={{ height: '100%', width: '100%' }}>{children}</div>;
};

export default InteractiveMap;
