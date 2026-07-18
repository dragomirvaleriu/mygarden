import React from 'react';
import { Visit, Client } from '../../src/types';
import { useTranslation } from 'react-i18next';
import { History, Phone, MessageCircle, MapPin, Clock } from 'lucide-react';
import { WhatsAppIcon } from '../WhatsAppIcon';
import { differenceInDays, parseISO } from 'date-fns';
import { parseSafeDate } from '../../utils/date';

interface Props {
  visit: Visit;
  allVisits?: Visit[];
  client?: Client;
  isPast: boolean;
  onClick: (visit: Visit) => void;
  onClientClick: (clientId: string, clientName: string, propertyId?: string, propertyName?: string) => void;
}

export const VisitCompactCard: React.FC<Props> = ({ visit, allVisits = [], client, isPast, onClick, onClientClick }) => {
  const { t } = useTranslation();
  const isPJ = client?.tip_persoana === 'PJ';
  const companyName = isPJ ? client?.numeFirma : null;
  const repName = client?.nume || visit.clientName;
  const address = visit.propertyAddress || client?.adresa || '';
  
  const cleanPhone = (client?.telefon || '').replace(/[^0-9+]/g, '');
  const waLink = `https://wa.me/${cleanPhone.startsWith('0') ? '4' + cleanPhone : cleanPhone}`;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  let displayName = '';
  if (companyName) {
    displayName += `${companyName}, `;
  }
  displayName += repName;

  // Calculate days since last visit
  const lastVisitDate = React.useMemo(() => {
    if (!allVisits.length || !visit.clientId) return null;
    const clientVisits = allVisits
      .filter(v => v.clientId === visit.clientId && v.status === 'Finalizat' && v.data && v.data < (visit.data || ''))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    
    return clientVisits[0]?.data || null;
  }, [allVisits, visit.clientId, visit.data]);

  const daysSinceLastVisit = React.useMemo(() => {
    if (!lastVisitDate) return null;
    try {
      return differenceInDays(new Date(), parseSafeDate(lastVisitDate));
    } catch (e) {
      return null;
    }
  }, [lastVisitDate]);

  return (
    <div 
      className={`group p-4 bg-bg-card border border-border-color shadow-sm hover:shadow-lg hover:border-accent-color transition-all w-full sm:w-72 rounded-2xl relative ${isPast ? 'opacity-60' : ''}`}
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 
              onClick={(e) => { e.stopPropagation(); onClick(visit); }}
              className={`font-black text-sm text-main leading-tight group-hover:text-accent-color transition-colors cursor-pointer hover:underline ${isPast ? 'line-through decoration-1 opacity-50' : ''} truncate`}
            >
              {displayName}
            </h4>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onClientClick(visit.clientId, displayName, visit.propertyId, visit.propertyAddress); 
              }}
              className="p-1 text-text-secondary hover:text-accent-color transition-colors shrink-0 flex items-center gap-1"
              title={t('Service History')}
            >
              <History size={14} />
              {daysSinceLastVisit !== null && <span className="text-[12.5px] font-bold italic">[{daysSinceLastVisit}z]</span>}
            </button>
          </div>
          

        </div>

        <div className="flex items-center gap-1 shrink-0">
          {client?.telefon && (
            <>
              <a 
                href={`tel:${cleanPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white transition-all"
                title={t('Call')}
              >
                <Phone size={12} />
              </a>
              <a 
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-all"
                title="WhatsApp"
              >
                <WhatsAppIcon size={12} />
              </a>
            </>
          )}
        </div>
      </div>

      {address && (
        <a 
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`flex items-start gap-1.5 text-[11px] text-text-secondary hover:text-blue-500 transition-colors mt-2 group/addr ${isPast ? 'line-through decoration-1 opacity-50' : ''}`}
          title={address}
        >
          <MapPin size={12} className="shrink-0 text-accent-color/50 group-hover/addr:text-blue-500" />
          <span className="truncate underline decoration-dotted underline-offset-2">{address}</span>
        </a>
      )}

      {visit.tipLucrare && (
        <div className="mt-3 pt-3 border-t border-border-color/30">
            <p className="text-[11px] font-bold text-main/70 uppercase tracking-wider line-clamp-1">{visit.tipLucrare}</p>
        </div>
      )}
    </div>
  );
};
