import React from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, MapPin, Droplets, Phone, Pencil, Trash2 } from 'lucide-react';
import { Client, Property, Visit, Page } from '../../src/types';
import { getMapsUrl } from '../../utils/maps';
import { formatLongDate, parseSafeDate } from '../../utils/date';
import { isIrrigatingToday } from '../../utils/irrigation';

interface Props {
  clients: Client[];
  properties: Property[];
  visits: Visit[];
  onNavigate: (page: Page, id?: string) => void;
  dragOverClientId: string | null;
  handleDragStart: (e: React.DragEvent, id: string) => void;
  handleDragOver: (e: React.DragEvent, id: string) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, id: string) => void;
  handleDragEnd: () => void;
  setDeleteClientModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; clientId: string }>>;
}

export const ClientTable: React.FC<Props> = ({
  clients,
  properties,
  visits,
  onNavigate,
  dragOverClientId,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
  setDeleteClientModal,
}) => {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-hidden w-full">
      <table className="w-full text-sm text-left text-text-secondary table-fixed">
        <thead className="text-xs text-text-secondary uppercase bg-bg-main">
          <tr>
            <th scope="col" className="px-1 py-3 w-5"></th>
            <th scope="col" className="px-4 py-3 w-[12%]">{t('Next Appt.')}</th>
            <th scope="col" className="px-4 py-3 w-[28%]">{t('Name')}</th>
            <th scope="col" className="px-4 py-3 w-[40%]">{t('Address')}</th>
            <th scope="col" className="px-4 py-3 w-[10%] text-center">{t('Phone')}</th>
            <th scope="col" className="px-4 py-3 w-[10%] text-center">{t('Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(client => {
            const clientProperties = properties
              .filter(p => p.clientId === client.id)
              .sort((a, b) => (a.order || 0) - (b.order || 0));
            const mainProperty = clientProperties.find(p => p.name === t("Main Location")) || clientProperties[0];
            const displayAddress = mainProperty?.address || client.adresa || '';
            const mapsLink = getMapsUrl(displayAddress, mainProperty?.mapsLink || client.Maps_link);
            const scheduledVisit = visits.find(v => v.clientId === client.id && (v.status === 'Programat' || v.status === 'Activ'));
            const nextVisitDate = scheduledVisit && scheduledVisit.data ? formatLongDate(parseSafeDate(scheduledVisit.data)) : '-';
            const cleanPhone = (client.telefon || '').replace(/[^0-9+]/g, '');
            const waLink = `https://wa.me/${cleanPhone.startsWith('0') ? '4' + cleanPhone : cleanPhone}`;

            const irrigating = mainProperty ? isIrrigatingToday(mainProperty) : false;

            const hasMaintenance = clientProperties.some(p => p.contractType === 'maintenance');
            const hasOneTime = clientProperties.some(p => p.contractType === 'one-time' || p.contractType === 'project');
            
            let iconBgClass = 'bg-gray-200 dark:bg-gray-700'; // Default
            if (client.status === 'Inactiv') {
                iconBgClass = 'bg-red-500';
            } else if (hasMaintenance && hasOneTime) {
                // Split color
                iconBgClass = 'bg-gradient-to-r from-blue-500 to-orange-500';
            } else if (hasOneTime) {
                // 25% darker/lighter
                iconBgClass = 'bg-orange-500';
            } else if (hasMaintenance) {
                iconBgClass = 'bg-blue-500';
            }

            const displayName = client.tip_persoana === 'PJ' 
              ? (
                  <div className="flex items-center gap-2 truncate">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${iconBgClass}`}>
                          PJ
                      </div>
                      <div className="flex flex-col truncate">
                          <span className="font-bold truncate" title={client.numeFirma}>{client.numeFirma}</span>
                          <span className="text-xs text-text-secondary truncate" title={client.nume}>{client.nume}</span>
                      </div>
                  </div>
              ) 
              : (
                  <div className="flex items-center gap-2 truncate">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${iconBgClass}`}>
                          PF
                      </div>
                      <span className="truncate block" title={client.nume}>{client.nume}</span>
                  </div>
              );

            return (
              <tr 
                key={client.id} 
                id={`client-row-${client.id}`}
                draggable
                onDragStart={(e) => handleDragStart(e, client.id)}
                onDragOver={(e) => handleDragOver(e, client.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, client.id)}
                onDragEnd={handleDragEnd}
                className={`bg-bg-card border-b border-border-color hover:bg-bg-main transition-colors ${dragOverClientId === client.id ? 'border-t-2 border-t-accent-color' : ''}`}
              >
                <td className="px-1 py-1 cursor-grab active:cursor-grabbing text-text-secondary hover:text-main text-center">
                  <GripVertical size={16} className="mx-auto" />
                </td>
                <td className="px-4 py-2 font-medium text-main truncate" title={nextVisitDate}>{nextVisitDate}</td>
                <td className="px-4 py-2 font-medium text-main truncate">{displayName}</td>
                <td className="px-4 py-2 truncate">
                  {mapsLink ? (
                    <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline truncate" title={displayAddress}>
                      <MapPin size={14} className="shrink-0" />
                      <span className="truncate">{displayAddress}</span>
                      {mainProperty?.irrigation && (
                        <Droplets 
                          size={12} 
                          className={`shrink-0 ${irrigating ? 'text-blue-500' : 'text-text-secondary/30'}`} 
                        />
                      )}
                    </a>
                  ) : (
                    <div className="flex items-center gap-1 text-text-secondary truncate" title={displayAddress}>
                      <MapPin size={14} className="shrink-0" />
                      <span className="truncate">{displayAddress}</span>
                      {mainProperty?.irrigation && (
                        <Droplets 
                          size={12} 
                          className={`shrink-0 ${irrigating ? 'text-blue-500' : 'text-text-secondary/30'}`} 
                        />
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-center gap-2">
                    {client.telefon && (
                      <a href={`tel:${cleanPhone}`} className="text-green-600 hover:text-green-800" title="Apelează">
                        <Phone size={14} strokeWidth={1.2} className="opacity-70" />
                      </a>
                    )}
                    {client.telefon && (
                      <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-[#25D366] hover:text-[#128C7E] opacity-70" title="WhatsApp">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => onNavigate(Page.ClientForm, client.id)} className="text-blue-600 hover:text-blue-800 opacity-70" title={t("Edit")}>
                      <Pencil size={14} strokeWidth={1.2} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteClientModal({ isOpen: true, clientId: client.id });
                      }} 
                      className="text-red-600 hover:text-red-800 opacity-70" 
                      title={t("Delete")}
                    >
                      <Trash2 size={14} strokeWidth={1.2} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
