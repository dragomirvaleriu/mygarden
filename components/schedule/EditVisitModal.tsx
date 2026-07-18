import React from 'react';
import { MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { SmartDateInput } from '../SmartDateInput';
import { parseSafeDate } from '../../utils/date';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isEditing: boolean;
  editingVisitId: string | null;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  properties: any[];
  clients: any[];
  visits: any[];
  employees: any[];
  userRole: string;
  accountType: string;
}

export const EditVisitModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  isEditing,
  editingVisitId,
  formData,
  setFormData,
  properties,
  clients,
  visits,
  employees,
  userRole,
  accountType
}) => {
  const { t } = useTranslation();
  const isPF = accountType === 'PF';

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose}></div>
      <div className="stihl-card w-full max-w-xl rounded-lg p-8 relative animate-in zoom-in duration-300 bg-bg-card">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary hover:text-main">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <h3 className="text-xl font-black mb-6 text-main">{isEditing ? t('Edit Appointment') : t('New Appointment')}</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          {!isPF && (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">{t('Select Client')}</label>
                <select 
                  className="w-full bg-bg-main border border-border-color rounded-md px-4 py-3 text-sm font-bold outline-none focus:border-accent-color" 
                  required 
                  value={formData.clientId || ''} 
                  onChange={e => {
                    const newClientId = e.target.value;
                    const clientProps = properties.filter(p => p.clientId === newClientId);
                    const defaultProp = clientProps.length > 0 ? clientProps[0] : null;

                    let nextDateStr = format(new Date(), 'yyyy-MM-dd');
                    const client = clients.find(c => c.id === newClientId);
                    if (client) {
                        const clientVisits = visits.filter(v => v.clientId === newClientId && v.status === 'Finalizat').sort((a,b) => (b.completedAt?.toMillis() || 0) - (a.completedAt?.toMillis() || 0));
                        let baseDate = new Date();
                        if (clientVisits.length > 0 && clientVisits[0].completedAt) {
                            const lastCompleted = clientVisits[0].completedAt;
                            baseDate = (lastCompleted && lastCompleted.toDate) ? lastCompleted.toDate() : new Date();
                        }
                        let daysToAdd = 0;
                        if (client.maintenanceFrequency === 'weekly') daysToAdd = 7;
                        else if (client.maintenanceFrequency === 'biweekly') daysToAdd = 14;
                        else if (client.maintenanceFrequency === 'monthly') daysToAdd = 28;

                        if (daysToAdd > 0) {
                            baseDate.setDate(baseDate.getDate() + daysToAdd);
                        }
                        nextDateStr = format(baseDate, 'yyyy-MM-dd');
                    }

                    setFormData((prev: any) => ({
                      ...prev, 
                      clientId: newClientId,
                      propertyId: defaultProp ? defaultProp.id : '', 
                      propertyAddress: defaultProp ? defaultProp.address : (client?.adresa || ''),
                      propertyMapsLink: defaultProp ? defaultProp.mapsLink : (client?.Maps_link || ''),
                      data: nextDateStr
                    }));
                  }}
                >
                  <option value="">{t('Choose client...')}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.tip_persoana === 'PJ' ? `${c.numeFirma || c.nume} (${c.nume})` : c.nume}</option>)}
                </select>
              </div>

              {formData.clientId && properties.filter(p => p.clientId === formData.clientId).length > 0 && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between ml-1">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Select Property')}</label>
                      {properties.filter(p => p.clientId === formData.clientId).length > 1 && (
                          <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full text-[11px] font-black animate-pulse">
                              <MapPin size={10} />
                              <span>{properties.filter(p => p.clientId === formData.clientId).length} LOCAȚII DISPONIBILE</span>
                          </div>
                      )}
                  </div>
                  <select 
                    className={`w-full bg-bg-main border ${properties.filter(p => p.clientId === formData.clientId).length > 1 ? 'border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'border-border-color'} rounded-md px-4 py-3 text-sm font-bold outline-none focus:border-accent-color disabled:opacity-50 transition-all`}
                    value={formData.propertyId || ''} 
                    disabled={properties.filter(p => p.clientId === formData.clientId).length === 1}
                    onChange={e => {
                      const propId = e.target.value;
                      const prop = properties.find(p => p.id === propId);
                      if (prop) {
                        const existingForProp = visits.find(v => 
                          v.propertyId === propId && 
                          (v.status === 'Programat' || v.status === 'Activ') &&
                          (!isEditing || v.id !== editingVisitId)
                        );
                        
                        setFormData((prev: any) => {
                          let finalDate = prev.data;
                          if (existingForProp) {
                              const d = parseSafeDate(existingForProp.data );
                              finalDate = format(d, 'yyyy-MM-dd');
                          }

                          return {
                            ...prev, 
                            propertyId: propId,
                            propertyAddress: prop.address,
                            propertyMapsLink: prop.mapsLink,
                            data: finalDate
                          };
                        });
                      }
                    }}
                  >
                      {properties.filter(p => p.clientId === formData.clientId).map(p => {
                        const propVisit = visits.find(v => 
                          v.propertyId === p.id && 
                          (v.status === 'Programat' || v.status === 'Activ') &&
                          (!isEditing || v.id !== editingVisitId)
                        );
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
              )}
            </>
          )}
          <div className={`grid grid-cols-1 ${isPF ? '' : 'sm:grid-cols-2'} gap-4`}>
            <SmartDateInput
                label={t('Data programării')}
                value={formData.data || ''}
                onChange={(val) => setFormData((prev: any) => ({ ...prev, data: val }))}
                required
                disablePastDates={!isEditing}
            />

            {!isPF && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">{t('Assign Employee', 'Atribuie Angajat')}</label>
                <select 
                  className="w-full bg-bg-main border border-border-color rounded-md px-4 py-3 text-sm font-bold outline-none focus:border-accent-color disabled:opacity-50 transition-all shadow-sm" 
                  value={formData.assignedTo || ''} 
                  disabled={userRole !== 'admin'}
                  required
                  onChange={e => setFormData((prev: any) => ({...prev, assignedTo: e.target.value}))}
                >
                    {employees.map(e => {
                      let empName = e.displayName;
                      if (!empName && e.email) {
                        empName = e.email.split('@')[0].split(/[._]/).map((p:string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
                      }
                      return (
                        <option key={e.uid} value={e.uid}>{empName || 'Angajat'}</option>
                      );
                    })}
                </select>
              </div>
            )}
          </div>
          {isEditing && editingVisitId && formData.status === 'Finalizat' && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {t('Start Time') || 'Ora Început'}
                </label>
                <input
                  type="time"
                  value={formData.oraInceput || ''}
                  onChange={e => setFormData((prev: any) => ({ ...prev, oraInceput: e.target.value }))}
                  className="w-full bg-bg-main border border-border-color rounded-md px-4 py-3 text-sm font-bold outline-none focus:border-accent-color transition-all"
                  placeholder="HH:MM"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  {t('End Time') || 'Ora Sfârșit'}
                </label>
                <input
                  type="time"
                  value={formData.oraSfarsit || ''}
                  onChange={e => setFormData((prev: any) => ({ ...prev, oraSfarsit: e.target.value }))}
                  className="w-full bg-bg-main border border-border-color rounded-md px-4 py-3 text-sm font-bold outline-none focus:border-accent-color transition-all"
                  placeholder="HH:MM"
                />
              </div>
            </div>
          )}
          <button type="submit" className="w-full stihl-button rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md mt-4">
            {isEditing ? t('Save Changes') : (accountType === 'PF' ? t('Log Activity') : t('Schedule'))}
          </button>
        </form>
      </div>
    </div>
  );
};
