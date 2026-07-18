import React, { useState, useMemo, useEffect } from 'react';
import { Visit, Client, Property } from '../src/types';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, parseISO, isValid } from 'date-fns';
import { ro, enUS, pl, cs } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight, Calendar, CheckCircle2, Clock, MapPin, Notebook, ExternalLink } from 'lucide-react';
import { parseSafeDate, formatLongDate, calculateDaysSinceLastVisit } from '../utils/date';

interface ClientHistoryModalProps {
  clientId: string;
  clientName: string;
  visits: Visit[];
  onClose: () => void;
  onViewProfile?: (clientId: string) => void;
  propertyId?: string;
  propertyName?: string;
  allProperties?: Property[];
}

export const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({
  clientId,
  clientName,
  visits,
  onClose,
  onViewProfile,
  propertyId,
  propertyName,
  allProperties = []
}) => {
  const { t, i18n } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Filter properties for this client
  const clientProperties = useMemo(() => {
    return allProperties.filter(p => p.clientId === clientId);
  }, [allProperties, clientId]);

  // Current property selection
  const [currentPropertyIndex, setCurrentPropertyIndex] = useState(() => {
    if (!propertyId) return 0;
    const idx = clientProperties.findIndex(p => p.id === propertyId);
    return idx === -1 ? 0 : idx;
  });

  const activeProperty = clientProperties[currentPropertyIndex];
  const activePropertyId = activeProperty?.id || propertyId;
  const activePropertyName = activeProperty?.address || activeProperty?.name || propertyName;

  const locales: any = { ro, en: enUS, pl, cs };
  const currentLocale = locales[i18n.language] || locales.ro;

  // Filter visits for this client and selected property
  const clientVisits = useMemo(() => {
    return visits.filter(v => {
      const isClient = v.clientId === clientId;
      if (!isClient) return false;
      if (activePropertyId) return v.propertyId === activePropertyId || !v.propertyId;
      return true;
    });
  }, [visits, clientId, activePropertyId]);

  const handlePrevProperty = () => {
    setCurrentPropertyIndex(prev => (prev === 0 ? clientProperties.length - 1 : prev - 1));
  };

  const handleNextProperty = () => {
    setCurrentPropertyIndex(prev => (prev === clientProperties.length - 1 ? 0 : prev + 1));
  };

  // Filter visits for the selected month
  const monthVisits = useMemo(() => {
    return clientVisits.filter(v => {
      const vDateStr = v.completedAt?.toDate ? v.completedAt.toDate().toISOString().split('T')[0] : v.data;
      const vDate = parseSafeDate(vDateStr);
      return isSameMonth(vDate, selectedMonth);
    }).sort((a, b) => {
      const dateAStr = a.completedAt?.toDate ? a.completedAt.toDate().toISOString().split('T')[0] : a.data;
      const dateBStr = b.completedAt?.toDate ? b.completedAt.toDate().toISOString().split('T')[0] : b.data;
      const dateA = parseSafeDate(dateAStr);
      const dateB = parseSafeDate(dateBStr);
      return dateA.getTime() - dateB.getTime(); // Oldest first
    });
  }, [clientVisits, selectedMonth]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="bg-bg-card w-full max-w-lg rounded-3xl border border-border-color shadow-2xl relative animate-in zoom-in duration-300 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border-color flex items-center justify-between bg-gradient-to-r from-accent-color/5 to-transparent">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-accent-color flex items-center justify-center text-white shadow-lg shadow-accent-color/20 shrink-0">
              <Calendar size={24} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-black text-main uppercase tracking-tighter leading-none mb-1 truncate">
                {clientName}
              </h3>
              <div className="flex items-center gap-2">
                {clientProperties.length > 1 && (
                  <button onClick={handlePrevProperty} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors text-text-secondary">
                    <ChevronLeft size={14} />
                  </button>
                )}
                <p className="text-[11px] font-bold text-text-secondary uppercase tracking-widest opacity-60 truncate">
                  {activePropertyName ? `${t('History')} - ${activePropertyName}` : t('Service History')}
                </p>
                {clientProperties.length > 1 && (
                  <button onClick={handleNextProperty} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors text-text-secondary">
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onViewProfile && (
              <button 
                onClick={() => {
                  onViewProfile(clientId);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-accent-color/10 text-accent-color text-[11px] font-black uppercase tracking-widest hover:bg-accent-color/20 transition-all flex items-center gap-2"
                title={t('View Profile')}
              >
                <ExternalLink size={14} />
                <span className="hidden sm:inline">{t('Profile')}</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-bg-main hover:bg-border-color text-text-secondary transition-all active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Month Selector */}
        <div className="px-6 py-4 bg-bg-main/50 flex items-center justify-between border-b border-border-color">
          <button 
            onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
            className="p-2 rounded-lg hover:bg-bg-card text-text-secondary transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="text-sm font-black text-main uppercase tracking-widest">
            {format(selectedMonth, 'MMMM yyyy', { locale: currentLocale })}
          </div>

          <button 
            onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
            className="p-2 rounded-lg hover:bg-bg-card text-text-secondary transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {monthVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-40">
              <Clock size={40} className="mb-4 text-text-secondary" />
              <p className="text-xs font-bold uppercase tracking-widest">{t('No visits in this period')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {monthVisits.map((v) => {
                const displayDateStr = v.completedAt?.toDate ? v.completedAt.toDate().toISOString().split('T')[0] : v.data;
                const displayDate = parseSafeDate(displayDateStr);
                const isFutureVisit = (() => {
                  if (v.status !== 'Programat') return false;
                  if (!displayDate) return false;
                  const todayAtMidnight = new Date();
                  todayAtMidnight.setHours(0, 0, 0, 0);
                  const vDateAtMidnight = new Date(displayDate);
                  vDateAtMidnight.setHours(0, 0, 0, 0);
                  return vDateAtMidnight.getTime() > todayAtMidnight.getTime();
                })();

                return (
                  <div 
                    key={v.id}
                    className={`p-4 rounded-2xl border border-border-color bg-bg-main/30 hover:border-accent-color/30 transition-all group ${
                      isFutureVisit ? 'opacity-70 select-none' : ''
                    }`}
                  >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        v.status === 'Finalizat' ? 'bg-green-500/10 text-green-500' : 
                        v.status === 'Activ' ? 'bg-accent-color/10 text-accent-color animate-pulse' : 
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {v.status === 'Finalizat' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                      </div>
                      <div>
                        {(() => {
                           let daysPassed: number | null = null;
                           if (v.status === 'Finalizat' && displayDate) {
                             const todayAtMidnight = new Date();
                             todayAtMidnight.setHours(0, 0, 0, 0);
                             const vDateAtMidnight = new Date(displayDate);
                             vDateAtMidnight.setHours(0, 0, 0, 0);
                             const diffTime = todayAtMidnight.getTime() - vDateAtMidnight.getTime();
                             daysPassed = Math.round(diffTime / (1000 * 60 * 60 * 24));
                             if (daysPassed < 0) daysPassed = 0;
                           }

                           const daysSinceLastVisit = (v.status === 'Programat' || v.status === 'Activ')
                             ? calculateDaysSinceLastVisit(visits, clientId, activePropertyId, v.id, undefined, displayDate || undefined)
                             : null;

                           return (
                             <div className="text-xs font-black text-main uppercase tracking-tighter flex items-center flex-wrap gap-1.5">
                               <span>{formatLongDate(displayDate)}</span>
                               {v.status === 'Finalizat' && daysPassed !== null && (
                                 <span className="text-[10.5px] font-bold italic text-green-600 dark:text-green-400 lowercase tracking-normal bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">
                                   {daysPassed === 0 ? 'azi' : daysPassed === 1 ? 'ieri' : `${daysPassed} zile în urmă`}
                                 </span>
                               )}
                               {(v.status === 'Programat' || v.status === 'Activ') && daysSinceLastVisit !== null && (
                                 <span className={`text-[10.5px] font-bold italic lowercase tracking-normal px-1.5 py-0.5 rounded shrink-0 ${
                                   v.status === 'Activ'
                                     ? 'text-accent-color bg-accent-color/10'
                                     : 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
                                 }`}>
                                   {isFutureVisit 
                                     ? `(vor fi ${daysSinceLastVisit} zile de la ultima vizită)`
                                     : `(${daysSinceLastVisit} zile de la ultima vizită)`
                                   }
                                 </span>
                               )}
                             </div>
                           );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Services Row */}
                  <div className="ml-11">
                    {v.servicii_efectuate && v.servicii_efectuate.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {v.servicii_efectuate.map((s, idx) => {
                          const unitLower = (s.unit || '').toLowerCase();
                          const isAreaUnit = unitLower === 'm²' || unitLower === 'mp' || unitLower === 'm2';
                          
                          const prop = allProperties.find(p => p.id === v.propertyId) || 
                                       (v.propertyAddress ? allProperties.find(p => p.address === v.propertyAddress || p.name === v.propertyAddress) : null) ||
                                       activeProperty;
                                       
                          const displayQuantity = isAreaUnit && prop && prop.surfaceArea
                            ? prop.surfaceArea
                            : s.quantity;

                          return (
                            <span 
                              key={idx}
                              className="px-2 py-1 bg-accent-color/5 border border-accent-color/10 rounded-lg text-[11px] font-black text-main uppercase tracking-tighter"
                            >
                              {s.name} {displayQuantity ? `(${displayQuantity} ${s.unit || ''})` : ''}
                            </span>
                          );
                        })}
                      </div>
                    ) : v.tipLucrare ? (
                      <div className="text-[11px] font-bold text-text-secondary italic">
                        {v.tipLucrare}
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold text-text-secondary opacity-40 uppercase tracking-widest">
                        {t('No specific services logged')}
                      </div>
                    )}

                    {v.detalii && (
                      <div className="mt-2 text-[11px] font-medium text-text-secondary opacity-80 italic">
                        {v.detalii}
                      </div>
                    )}

                    {v.finishNote && (
                      <div className="mt-3 p-3 bg-bg-card/50 rounded-2xl border border-border-color/50 flex gap-2">
                        <Notebook size={12} className="text-accent-color shrink-0 mt-0.5" />
                        <p className="text-[11px] font-medium text-text-secondary leading-tight">
                          {v.finishNote}
                        </p>
                      </div>
                    )}

                    {v.photos && v.photos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {v.photos.map((url, idx) => (
                          <div key={idx} className="w-16 h-16 rounded-xl overflow-hidden border border-border-color shadow-sm">
                            <img src={url} alt="Visit photo" className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-bg-main/30 border-t border-border-color flex justify-center">
          <p className="text-[11px] font-black text-text-secondary uppercase tracking-[0.2em] opacity-40">
            Scapeflow Archive Systems
          </p>
        </div>
      </div>
    </div>
  );
};
