import React from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays, endOfWeek, getDay } from 'date-fns';
import { Visit, Client, Property, Page } from '../../../src/types';
import { parseSafeDate, formatVisitDate, calculateDaysSinceLastVisit, calculateDaysSinceVisitCompleted } from '../../../utils/date';
import { resolveAndParseMapsLink, getGoogleMapsDirDestination } from '../../../utils/maps';
import { optimizeRouteNearestNeighbor } from '../../../utils/routeUtils';
import { db, writeBatch, doc } from '../../../services/firebase';
import { isIrrigatingToday } from '../../../utils/irrigation';
import { Square, Play, UserPlus, History, Droplets, Phone, MapPin, Loader2, Navigation, Map as MapIcon, CalendarClock, Sprout } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

interface Props {
  agendaVisits: Visit[];
  visits: Visit[];
  clients: Client[];
  properties: Property[];
  workDays: 'L-V' | 'L-S' | 'L-D';
  currentLocale: any;
  userName: string;
  isMobile: boolean;
  onNavigate: (page: any, id?: string) => void;
  handleEditClick: (visit: Visit) => void;
  handleOpenFinish: (visit: Visit) => void;
  handleStartWork: (visit: Visit) => void;
  setShowHistoryModal: React.Dispatch<React.SetStateAction<any>>;
  organization?: any;
  onFertilizerClick?: (clientId: string, propertyId?: string) => void;
}

export const DailyAgendaView: React.FC<Props> = ({
  agendaVisits,
  visits,
  clients,
  properties,
  workDays,
  currentLocale,
  userName,
  isMobile,
  onNavigate,
  handleEditClick,
  handleOpenFinish,
  handleStartWork,
  setShowHistoryModal,
  organization,
  onFertilizerClick,
}) => {
  const { t } = useTranslation();
  const [optimizedOrder, setOptimizedOrder] = React.useState<Record<string, string[]>>({});
  const [optimizingDate, setOptimizingDate] = React.useState<string | null>(null);

  const handleOptimize = async (dateStr: string, dayVisits: Visit[]) => {
    setOptimizingDate(dateStr);
    try {
      const points: {id: string, lat: number, lng: number}[] = [];
      for (const v of dayVisits) {
        const prop = properties.find(p => p.id === v.propertyId);
        const leadMapsLink = (v as any).leadData?.mapsLink || (v as any).mapsLink;
        const linkSource = prop?.mapsLink || leadMapsLink || v.propertyAddress || prop?.address;
        
        if (linkSource) {
           const coords = await resolveAndParseMapsLink(linkSource);
           if (coords) {
             points.push({ id: v.id, lat: coords.lat, lng: coords.lng });
           }
        }
      }
      
      let startCoords = points.length > 0 ? { lat: points[0].lat, lng: points[0].lng } : null;
      
      // Try to get actual GPS if available
      if (navigator.geolocation) {
          try {
             const pos: GeolocationPosition = await new Promise((resolve, reject) => {
                 navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
             });
             startCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          } catch(e) {
             // fallback to first point
          }
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
         
         const finalOrder = [...order, ...unmapped];
         
         // Save to Firestore using batch
         const batch = writeBatch(db);
         finalOrder.forEach((id, index) => {
           if (id.startsWith('lead_')) {
             const realId = id.replace('lead_', '');
             batch.update(doc(db, 'leads', realId), { orderIndex: index });
           } else {
             batch.update(doc(db, 'visits', id), { orderIndex: index });
           }
         });
         await batch.commit();
      }
    } catch(e) {
      console.error("Optimization failed", e);
    } finally {
      setOptimizingDate(null);
    }
  };

  const openDayInGoogleMaps = async (dayVisits: Visit[], dateStr: string) => {
    const activeVisits = dayVisits.filter(v => v.status !== 'Finalizat');
    if (activeVisits.length === 0) return;

    const orderedVisits = [...activeVisits].sort((a, b) => {
      const aIndex = a.orderIndex !== undefined ? a.orderIndex : 999;
      const bIndex = b.orderIndex !== undefined ? b.orderIndex : 999;
      return aIndex - bIndex;
    });

    const destinations: string[] = [];
    
    for (const v of orderedVisits) {
      const prop = properties.find(p => p.id === v.propertyId);
      const client = clients.find(c => c.id === v.clientId);
      const dest = getGoogleMapsDirDestination(v, prop, client);
      if (dest) {
        destinations.push(dest);
      }
    }

    if (organization) {
      const hqSource = organization.mapsLink || organization.address;
      if (hqSource) {
        const match = hqSource.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
        if (match) {
          destinations.push(`${match[1]},${match[2]}`);
        } else {
          destinations.push(encodeURIComponent(hqSource));
        }
      }
    }

    if (destinations.length === 0) return;

    let url = `https://www.google.com/maps/dir/`;
    let userLocStr = '';
    if (navigator.geolocation) {
      try {
        const pos: GeolocationPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        });
        userLocStr = `${pos.coords.latitude},${pos.coords.longitude}/`;
      } catch (e) {
        // ignore
      }
    }

    url += userLocStr + destinations.join('/');

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div id="schedule-content-anchor" className="moleskine-paper p-4 sm:p-6 dark:p-3 dark:sm:p-4 rounded-sm shadow-xl border border-[#e5e0d5] dark:border-[#2a2a2a] min-h-[800px] text-[#002b66] dark:text-white/90 font-handwritten overflow-hidden">
       <h2 className="text-3xl font-typewriter text-center mb-1 dark:mb-1 tracking-tighter">{t('DAILY AGENDA')}</h2>
       <p className="text-center font-typewriter text-xl mb-4 opacity-80">
         @ {userName} !
       </p>
       
       <div className="relative h-4 mb-4 flex items-center justify-center pointer-events-none">
         <div className="absolute w-full h-[4px] bg-[#333] dark:bg-white opacity-30 dark:opacity-10 transform -rotate-1 rounded-full blur-[0.5px]"></div>
         <div className="absolute w-[98%] h-[2px] bg-[#333] dark:bg-white opacity-50 dark:opacity-20 transform rotate-0.5 rounded-full"></div>
       </div>

       <div className="space-y-0">
         {(() => {
           const todayStr = format(new Date(), 'yyyy-MM-dd');
           const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

           const groupedByDate = agendaVisits.reduce((acc, v) => {
             const d = v.data || t('No Date');
             if (!acc[d]) acc[d] = [];
             acc[d].push(v);
             return acc;
           }, {} as Record<string, typeof agendaVisits>);

           const sortedDates = Object.keys(groupedByDate).sort();

           const currentWeekEndStr = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

           return sortedDates.filter(dateStr => {
             if (dateStr === t('No Date')) return true;
             return true;
           }).map((dateStr, index, array) => {
             const dayVisits = groupedByDate[dateStr];
             const isToday = dateStr === todayStr;
             const isTomorrow = dateStr === tomorrowStr;
             
             const isNextWeek = dateStr !== t('No Date') && dateStr > currentWeekEndStr;
             const prevDateStr = index > 0 ? array[index - 1] : null;
             const prevIsNextWeek = prevDateStr && prevDateStr !== t('No Date') && prevDateStr > currentWeekEndStr;
             const showSeparator = isNextWeek && !prevIsNextWeek;
             
             let dateLabel = '';
             if (isToday) {
               dateLabel = `${t('Today')} (${formatVisitDate(dateStr)})`;
             } else if (isTomorrow) {
               dateLabel = `${t('Tomorrow')} (${formatVisitDate(dateStr)})`;
             } else {
               try {
                 const d = parseSafeDate(dateStr);
                 const dayName = format(d, 'EEEE', { locale: currentLocale });
                 dateLabel = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} (${formatVisitDate(dateStr)})`;
               } catch (e) {
                 dateLabel = dateStr;
               }
             }

             return (
               <React.Fragment key={dateStr}>
                 {showSeparator && (
                   <div className="my-8 relative flex items-center justify-center">
                     <div className="absolute w-full h-[1px] bg-[#333] dark:bg-white opacity-20"></div>
                     <span className="relative bg-[#fefdfb] dark:bg-[#1a1a1a] px-4 text-sm font-bold text-[#0047ab] dark:text-white/70 uppercase tracking-widest font-sans">
                       {t('Next Week')}
                     </span>
                   </div>
                 )}
                   <div className="mb-4 flex flex-row items-center justify-between gap-2">
                     <div className="flex items-center gap-3">
                       <h3 className="text-2xl font-bold opacity-90">{dateLabel}</h3>
                       <div className="flex items-center gap-2">
                         {dayVisits.length > 1 && (
                           <button 
                             onClick={() => handleOptimize(dateStr, dayVisits)}
                             disabled={optimizingDate === dateStr}
                             className="p-1.5 md:p-2 rounded-xl bg-transparent md:bg-accent-color text-accent-color md:text-white border border-transparent md:border-accent-color hover:scale-105 active:scale-95 transition-all md:shadow-md flex items-center justify-center"
                             title={optimizedOrder[dateStr] ? t('Re-optimizează Traseul') : t('Optimizează Traseul')}
                           >
                             {optimizingDate === dateStr ? (
                               <Loader2 size={18} className="animate-spin" />
                             ) : (
                               <Navigation size={18} className={optimizedOrder[dateStr] ? "" : "animate-pulse"} />
                             )}
                           </button>
                         )}
                         {dayVisits.length > 0 && (
                           <button 
                             onClick={() => openDayInGoogleMaps(dayVisits, dateStr)}
                             className="p-1.5 md:p-2 bg-transparent md:bg-[#4285F4] text-[#4285F4] md:text-white rounded-xl hover:bg-black/5 md:hover:bg-[#357ae8] hover:scale-105 active:scale-95 transition-all md:shadow-md border border-transparent md:border-[#4285F4] flex items-center justify-center"
                             title={t('Deschide traseul în Google Maps')}
                           >
                             <MapIcon size={18} />
                           </button>
                         )}
                       </div>
                     </div>
                   </div>
                  <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-3">
                 {[...dayVisits].sort((a, b) => {
                   if (a.status === 'Finalizat' && b.status !== 'Finalizat') return 1;
                   if (a.status !== 'Finalizat' && b.status === 'Finalizat') return -1;
                   const aIndex = a.orderIndex !== undefined ? a.orderIndex : 999;
                   const bIndex = b.orderIndex !== undefined ? b.orderIndex : 999;
                   if (aIndex !== bIndex) return aIndex - bIndex;
                   const aIsLead = (a as any).isLead;
                   const bIsLead = (b as any).isLead;
                   if (aIsLead && !bIsLead) return -1;
                   if (!aIsLead && bIsLead) return 1;
                   return (a.clientName || '').localeCompare(b.clientName || '');
                 }).map((v) => {
                     const isActive = v.status === 'Activ';
                     const isLead = (v as any).isLead;
                     const leadData = (v as any).leadData;
                     const client = clients.find(c => c.id === v.clientId);
                     const prop = properties.find(p => p.id === v.propertyId);
                     const physicalAddress = prop?.address || v.propertyAddress;

                     let shouldPulsate = false;
                     if (isLead && leadData?.status === 'ofertat' && leadData?.ofertatAt) {
                         const ofertatDate = leadData.ofertatAt.toDate ? leadData.ofertatAt.toDate() : new Date(leadData.ofertatAt);
                         const diffTime = Math.abs(new Date().getTime() - ofertatDate.getTime());
                         const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                         if (diffDays >= 7) {
                             shouldPulsate = true;
                         }
                     }
                     
                     const diffDays = v.status === 'Finalizat'
                       ? calculateDaysSinceVisitCompleted(v)
                       : calculateDaysSinceLastVisit(visits, v.clientId, v.propertyId, v.id);
                     
                     const isReprogrammed = !!(v.originalData && v.data !== v.originalData);
                     const originalDataFormatted = isReprogrammed && v.originalData 
                       ? (() => { try { return format(parseSafeDate(v.originalData), 'd MMM', { locale: currentLocale }); } catch { return v.originalData; } })()
                       : null;

                     let effectiveFertDate = prop?.lastSolidFertilizerDate || client?.lastSolidFertilizerDate;
                     if (client) {
                       const clientVisits = visits.filter(vItem => vItem.clientId === client.id);
                       const fertVisits = clientVisits.filter(vItem => 
                         vItem.status === 'Finalizat' && 
                         vItem.servicii_efectuate?.some(s => {
                           const n = (s.name || '').toLowerCase();
                           return n.includes('îngrășământ') || n.includes('ingrasamant') || n.includes('fertiliz');
                         })
                       ).sort((a, b) => parseSafeDate(b.data).getTime() - parseSafeDate(a.data).getTime());
                       if (fertVisits.length > 0 && fertVisits[0].data) {
                         if (!effectiveFertDate || parseSafeDate(fertVisits[0].data).getTime() > parseSafeDate(effectiveFertDate).getTime()) {
                           effectiveFertDate = fertVisits[0].data;
                         }
                       }
                     }
                     const daysSinceFertilizer = effectiveFertDate ? Math.floor((Date.now() - new Date(effectiveFertDate).getTime()) / (1000 * 60 * 60 * 24)) : null;
                     const showFertilizerBadge = daysSinceFertilizer !== null && daysSinceFertilizer >= 30;
                     const fertilizerColor = daysSinceFertilizer !== null && daysSinceFertilizer >= 60 ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' : 'text-green-500 bg-green-500/10 hover:bg-green-500/20';
                     
                     return (
                        <motion.div 
                          variants={staggerItem}
                          key={v.id} 
                          onClick={() => handleEditClick(v)}
                          className={`pen-line py-1.5 dark:py-1 flex items-center gap-3 transition-colors cursor-pointer group whitespace-nowrap ${isLead ? 'bg-lead-accent hover:bg-lead-accent-hover text-purple-700 dark:text-purple-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        >
                         {!isLead ? (
                           <div className="mt-0.5 flex-shrink-0 mr-1">
                             <button 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 if (isActive) handleOpenFinish(v);
                                 else handleStartWork(v); 
                               }}
                               className={`${isActive 
                                 ? 'w-8 h-8 sm:w-5 sm:h-5 rounded-lg sm:rounded-sm bg-accent-color text-white border-accent-color shadow-md shadow-accent-color/20' 
                                 : 'w-8 h-8 sm:w-5 sm:h-5 rounded-full sm:rounded-none sm:hand-drawn-circle border-accent-color sm:border-[#333] bg-accent-color/10 sm:bg-transparent'} group-hover:border-accent-color transition-all flex items-center justify-center border-2 shrink-0`}
                             >
                               {isActive ? (
                                 <Square size={14} fill="currentColor" className="sm:w-2 sm:h-2" />
                               ) : (
                                 <Play size={14} className={`text-accent-color sm:text-inherit ml-0.5 sm:w-2.5 sm:h-2.5 ${isActive ? 'opacity-100' : 'opacity-100 sm:opacity-0 group-hover:opacity-100'} transition-opacity`} fill="currentColor" />
                               )}
                             </button>
                           </div>
                         ) : (
                           <div className="mt-0.5 flex-shrink-0 mr-1">
                             <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                               <UserPlus size={10} className="text-purple-600 dark:text-purple-400" />
                             </div>
                           </div>
                         )}
                         <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                            <div className="text-xl sm:text-2xl leading-tight flex items-center gap-1 min-w-0">
                              
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isLead && v.clientId) onNavigate(Page.Details, v.clientId);
                                }}
                                className={`text-left font-bold text-xl sm:text-[22px] text-[#002b66] dark:text-white px-1 rounded shrink-0 truncate hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${client?.tip_persoana === 'PJ' ? 'max-w-[180px] sm:max-w-[160px]' : 'max-w-[260px] sm:max-w-[240px]'} ${shouldPulsate ? 'animate-pulsate-bg' : ''}`}
                              >
                                {isLead ? v.clientName : (client?.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : (client?.nume || v.clientName))}
                              </button>

                              {client?.tip_persoana === 'PJ' && client.nume && !isLead && (
                                <span className="opacity-100 dark:opacity-60 text-lg shrink-0">
                                  / {client.nume}
                                </span>
                              )}

                              {!isMobile && (
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const clientObj = clients.find(c => c.id === v.clientId) || clients.find(c => c.nume === v.clientName);
                                    const companyName = clientObj?.tip_persoana === 'PJ' ? clientObj.numeFirma : '';
                                    const contactName = clientObj?.nume || v.clientName || 'Client Necunoscut';
                                    const displayName = companyName ? `${companyName} (${contactName})` : contactName;
                                    setShowHistoryModal({ clientId: v.clientId, clientName: displayName, propertyId: v.propertyId, propertyName: v.propertyAddress }); 
                                  }}
                                  className="p-1 text-text-secondary hover:text-accent-color hover:bg-accent-color/10 rounded-lg transition-all shrink-0 flex items-center gap-1"
                                  title={t('Service History')}
                                >
                                  <History size={18} />
                                  {diffDays !== null && <span className="text-lg sm:text-xl font-bold italic">[{diffDays}z]</span>}
                                </button>
                              )}
                              
                              {!isMobile && physicalAddress && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <a 
                                    href={v.propertyMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(physicalAddress)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="opacity-60 dark:opacity-40 italic text-base hover:text-accent-color transition-colors max-w-[500px] truncate pr-2"
                                  >
                                    ({physicalAddress})
                                  </a>
                                  {v.propertyId && prop?.irrigation && (
                                    <Droplets 
                                      size={18} 
                                      className={isIrrigatingToday(prop, v.data ? parseSafeDate(v.data) : new Date()) ? "text-blue-500 flex-shrink-0" : "text-gray-300 flex-shrink-0"} 
                                    />
                                  )}
                                  {showFertilizerBadge && (
                                     <button 
                                       title={t('Zile de la ultima fertilizare - Istoric')} 
                                       className={`flex items-center gap-1 p-1.5 rounded-lg shrink-0 transition-colors ${fertilizerColor}`}
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         if (onFertilizerClick) onFertilizerClick(client?.id || '', v.propertyId);
                                       }}
                                     >
                                       <Sprout size={16} />
                                       <span className="text-[12px] font-bold">{daysSinceFertilizer}z</span>
                                     </button>
                                   )}
                                </div>
                              )}
                              
                               {isReprogrammed && (
                                 <span 
                                   className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 shrink-0 ml-auto sm:ml-2" 
                                   title={originalDataFormatted ? `${t('Rescheduled from')} ${originalDataFormatted}` : t('Reprogrammed')}
                                 >
                                   <CalendarClock size={12} />
                                   {!isMobile && (originalDataFormatted || t('Reprogrammed'))}
                                 </span>
                               )}

                              {(isLead ? (v as any).leadData?.telefon : client?.telefon) && (
                                  <div className={`flex items-center gap-2 shrink-0 ${!isReprogrammed ? 'ml-auto' : ''} sm:ml-1`}>
                                  <a 
                                    href={`tel:${isLead ? (v as any).leadData.telefon : client?.telefon}`} 
                                    onClick={(e) => e.stopPropagation()} 
                                    className="w-7 h-7 flex items-center justify-center bg-[#f4f5ee] dark:bg-white/5 text-[#556b2f] dark:text-[#a3b87a] hover:bg-[#556b2f] hover:text-white rounded-lg transition-all"
                                  >
                                    <Phone size={14} strokeWidth={2} />
                                  </a>
                                  <a 
                                    href={`https://wa.me/${(() => {
                                      const p = (isLead ? (v as any).leadData.telefon : client?.telefon) || '';
                                      const c = p.replace(/\D/g, '');
                                      return c.startsWith('0') ? '4' + c : c;
                                    })()}`} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={(e) => e.stopPropagation()} 
                                    className="w-7 h-7 flex items-center justify-center bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500 hover:text-white rounded-lg transition-all"
                                    title="WhatsApp"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                      <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                                    </svg>
                                  </a>
                                </div>
                              )}
                            </div>
                           {isMobile && (
                             <div className="flex items-center justify-between px-1 mt-0.5 w-full gap-2">
                               {physicalAddress && (
                                 <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                   <a 
                                     href={v.propertyMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(physicalAddress)}`}
                                     target="_blank"
                                     rel="noreferrer"
                                     onClick={(e) => e.stopPropagation()}
                                     className="text-sm leading-none opacity-60 italic truncate hover:text-accent-color transition-colors"
                                   >
                                     {physicalAddress}
                                   </a>
                                   {v.propertyId && prop?.irrigation && (
                                     <Droplets 
                                       size={18} 
                                       className={isIrrigatingToday(prop, v.data ? parseSafeDate(v.data) : new Date()) ? "text-blue-500 flex-shrink-0" : "text-gray-300 flex-shrink-0"} 
                                     />
                                   )}
                                 </div>
                               )}
                               
                               <div className="flex items-center gap-3 shrink-0 ml-auto">
                                 {showFertilizerBadge && (
                                   <button 
                                     title={t('Zile de la ultima fertilizare - Istoric')} 
                                     className={`flex items-center gap-1 p-1.5 rounded-lg shrink-0 transition-colors ${fertilizerColor}`}
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       if (onFertilizerClick) onFertilizerClick(client?.id || '', v.propertyId);
                                     }}
                                   >
                                     <Sprout size={16} />
                                     <span className="text-[12px] font-bold">{daysSinceFertilizer}z</span>
                                   </button>
                                 )}
                                 <button 
                                   onClick={(e) => { 
                                     e.stopPropagation(); 
                                     const clientObj = clients.find(c => c.id === v.clientId) || clients.find(c => c.nume === v.clientName);
                                     const companyName = clientObj?.tip_persoana === 'PJ' ? clientObj.numeFirma : '';
                                     const contactName = clientObj?.nume || v.clientName || 'Client Necunoscut';
                                     const displayName = companyName ? `${companyName} (${contactName})` : contactName;
                                     setShowHistoryModal({ clientId: v.clientId, clientName: displayName, propertyId: v.propertyId, propertyName: v.propertyAddress }); 
                                   }}
                                   className="text-text-secondary hover:text-accent-color transition-all flex items-center gap-1 shrink-0"
                                 >
                                   <History size={18} />
                                   {diffDays !== null && <span className="text-lg sm:text-xl font-bold italic">[{diffDays}z]</span>}
                                 </button>
                               </div>
                             </div>
                           )}
                         </div>
                        </motion.div>
                     );
                   })}
                 </motion.div>
                 {isToday && (
                   <div className="relative h-4 mt-3 mb-1 flex items-center justify-center pointer-events-none">
                     <div className="absolute w-full h-[4px] bg-[#333] dark:bg-white opacity-30 dark:opacity-10 transform -rotate-1 rounded-full blur-[0.5px]"></div>
                     <div className="absolute w-[98%] h-[2px] bg-[#333] dark:bg-white opacity-50 dark:opacity-20 transform rotate-0.5 rounded-full"></div>
                   </div>
                 )}
              </React.Fragment>
             );
           });
         })()}
       </div>
    </div>
  );
};
