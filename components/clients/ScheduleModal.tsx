import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Property, Visit, UserProfile, Client } from '../../src/types';
import { SmartDateInput } from '../SmartDateInput';
import { parseSafeDate } from '../../utils/date';

interface ScheduleModalState {
  isOpen: boolean;
  client: Client | null;
  date: string;
  assignedTo: string;
  propertyId: string;
}

interface Props {
  scheduleModal: ScheduleModalState;
  setScheduleModal: React.Dispatch<React.SetStateAction<ScheduleModalState>>;
  properties: Property[];
  visitsByClientId: Record<string, Visit[]>;
  employees: UserProfile[];
  isProcessing: boolean;
  handleSchedule: () => void;
}

export const ScheduleModal: React.FC<Props> = ({
  scheduleModal,
  setScheduleModal,
  properties,
  visitsByClientId,
  employees,
  isProcessing,
  handleSchedule,
}) => {
  const { t } = useTranslation();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && scheduleModal.isOpen) {
        setScheduleModal(prev => ({ ...prev, isOpen: false }));
      }
    };
    if (scheduleModal.isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scheduleModal.isOpen, setScheduleModal]);

  if (!scheduleModal.isOpen || !scheduleModal.client) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setScheduleModal({ ...scheduleModal, isOpen: false })}></div>
      <div className="stihl-card w-full max-w-xl rounded-lg p-8 relative bg-bg-card animate-in zoom-in duration-300">
        <button onClick={() => setScheduleModal({ ...scheduleModal, isOpen: false })} className="absolute top-4 right-4 text-text-secondary hover:text-main"><X size={20} /></button>
        <h3 className="text-xl font-black text-main mb-1">{t('Quick Appointment')}</h3>
        <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-6">{scheduleModal.client.nume}</p>
        
        <div className="space-y-4">
            {/* Property Selection */}
            {(() => {
                const clientProps = properties.filter(p => p.clientId === scheduleModal.client?.id);
                if (clientProps.length === 0) return null;
                return (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Selectează Locație</label>
                            {clientProps.length > 1 && (
                                <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full text-[11px] font-black animate-pulse">
                                    <MapPin size={10} />
                                    <span>{clientProps.length} LOCAȚII DISPONIBILE</span>
                                </div>
                            )}
                        </div>
                        <select
                            className={`w-full bg-bg-main border ${clientProps.length > 1 ? 'border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'border-border-color'} rounded-md px-4 py-3 text-sm font-bold text-main outline-none focus:border-accent-color disabled:opacity-50 transition-all`}
                            value={scheduleModal.propertyId || ''}
                            onChange={(e) => {
                                const newPropId = e.target.value;
                                const existingForProp = (visitsByClientId[scheduleModal.client!.id] || [])
                                    .find(v => v.propertyId === newPropId && (v.status === 'Programat' || v.status === 'Activ'));
                                
                                setScheduleModal(prev => {
                                    let finalDate = prev.date;
                                    if (existingForProp) {
                                        const d = parseSafeDate(existingForProp.data );
                                        finalDate = format(d, 'dd.MM.yyyy');
                                    }

                                    return { 
                                        ...prev, 
                                        propertyId: newPropId,
                                        date: finalDate
                                    };
                                });
                            }}
                            disabled={clientProps.length === 1}
                        >
                            {clientProps.map(p => {
                                const propVisit = (visitsByClientId[scheduleModal.client!.id] || [])
                                    .find(v => v.propertyId === p.id && (v.status === 'Programat' || v.status === 'Activ'));
                                let dateLabel = t('No schedule');
                                if (propVisit) {
                                    const d = parseSafeDate(propVisit.data );
                                    dateLabel = `${t("Scheduled on")} ${format(d, "dd.MM.yyyy")}`;
                                }
                                return (
                                    <option key={p.id} value={p.id}>{p.name} - {p.address} [{dateLabel}]</option>
                                );
                            })}
                        </select>
                    </div>
                );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SmartDateInput
                    label={t("Visit Date")}
                    value={scheduleModal.date}
                    onChange={(val) => setScheduleModal(prev => ({ ...prev, date: val }))}
                    required
                />

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">{t('Responsible')}</label>
                    <select
                        className="w-full bg-bg-main border border-border-color rounded-md px-4 py-3 text-sm font-bold text-main outline-none focus:border-accent-color"
                        value={scheduleModal.assignedTo || ''}
                        onChange={(e) => setScheduleModal({ ...scheduleModal, assignedTo: e.target.value })}
                        required
                    >
                        <option value="" disabled>{t('Select Employee')}</option>
                        {employees.map(emp => (
                            <option key={emp.uid} value={emp.uid}>{emp.displayName || emp.email}</option>
                        ))}
                    </select>
                </div>
            </div>
            <button 
                onClick={handleSchedule}
                disabled={isProcessing || !scheduleModal.date || !scheduleModal.assignedTo}
                className="w-full stihl-button py-3 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md mt-4 flex items-center justify-center gap-2"
            >
                {isProcessing ? t('Scheduling...') : <><Calendar size={16} /> {t('Schedule Visit')}</>}
            </button>
        </div>
      </div>
    </div>
  );
};
