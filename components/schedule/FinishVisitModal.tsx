import React from 'react';
import { Camera, CalendarIcon, CheckCircle2, DollarSign, List, Notebook, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../../services/firebase';
import { parseSafeDate } from '../../utils/date';

const normalizeAddress = (addr?: string): string => {
  if (!addr) return '';
  return addr.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const defaultFertilizerDosage = 25; // 25g/mp default

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedVisit: any;
  visits: any[];
  properties: any[];
  clients: any[];
  serviceTypes: any[];
  isProcessing: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, visit: any) => Promise<void>;
  setPhotoViewer: (url: string) => void;
  finishNote: string;
  setFinishNote: (v: string) => void;
  editVisitDate: string;
  setEditVisitDate: (v: string) => void;
  editVisitStartTime: string;
  setEditVisitStartTime: (v: string) => void;
  editVisitEndTime: string;
  setEditVisitEndTime: (v: string) => void;
  interventieCost: string;
  setInterventieCost: (v: string) => void;
  interventieIncasata: boolean;
  setInterventieIncasata: (v: boolean) => void;
  selectedServices: Record<string, {selected: boolean, quantity: string}>;
  setSelectedServices: React.Dispatch<React.SetStateAction<Record<string, {selected: boolean, quantity: string}>>>;
  handleFinalize: () => Promise<void>;
  setMathProblem: React.Dispatch<React.SetStateAction<any>>;
  setConfirmationModal: React.Dispatch<React.SetStateAction<any>>;
}

export const FinishVisitModal: React.FC<Props> = ({
  isOpen, onClose, selectedVisit, visits, properties, clients, serviceTypes,
  isProcessing, handleFileUpload, setPhotoViewer,
  finishNote, setFinishNote, editVisitDate, setEditVisitDate,
  editVisitStartTime, setEditVisitStartTime, editVisitEndTime, setEditVisitEndTime,
  interventieCost, setInterventieCost, interventieIncasata, setInterventieIncasata,
  selectedServices, setSelectedServices, handleFinalize,
  setMathProblem, setConfirmationModal
}) => {
  const { t } = useTranslation();

  if (!isOpen || !selectedVisit) return null;

  const currentVisit = visits.find(v => v.id === selectedVisit.id) || selectedVisit;

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

  return (
        <div className="fixed inset-0 z-[2010] flex items-center justify-center p-1 sm:p-2" onClick={(e) => {
            if (e.target === e.currentTarget) {
                (document.activeElement as HTMLElement)?.blur();
            }
        }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose}></div>
          <div className="stihl-card w-full max-w-lg rounded-lg p-2 sm:p-3 relative bg-bg-card max-h-[85vh] flex flex-col">
             <div className="flex justify-between items-start mb-1 sm:mb-2 flex-shrink-0">
                <div>
                   <h3 className="text-base font-black text-main">Raport Finalizare</h3>
                   <p className="text-[11px] font-bold text-text-secondary truncate max-w-[200px] sm:max-w-[250px]" title={`${selectedVisit.clientName} ${selectedVisit.propertyAddress ? `- ${selectedVisit.propertyAddress}` : ''}`}>
                     {selectedVisit.clientName} {selectedVisit.propertyAddress ? `- ${selectedVisit.propertyAddress}` : ''}
                   </p>
                </div>
                <div className="flex items-center gap-1">
                   {isProcessing && <Loader2 size={16} className="animate-spin text-accent-color" />}
                   <label className="p-1 rounded-xl bg-accent-color/10 text-accent-color hover:bg-accent-color/20 cursor-pointer transition-all border border-accent-color/20 shadow-sm" title={t('Add Photos')}>
                      <Camera size={16} />
                      <input 
                         type="file" 
                         accept="image/*" 
                         multiple 
                         className="hidden" 
                         onChange={(e) => handleFileUpload(e, currentVisit)} 
                      />
                   </label>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-1 sm:space-y-2" onClick={(e) => {
                 if (e.target === e.currentTarget) {
                    (document.activeElement as HTMLElement)?.blur();
                 }
             }}>
                {(() => {
                  return (
                    <>
                      {currentVisit.photos && currentVisit.photos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                          {currentVisit.photos.map((url: string, idx: number) => (
                            <div key={idx} className="relative w-14 h-14 flex-shrink-0 group">
                              <img 
                                src={url} 
                                className="w-full h-full object-cover rounded-lg border border-border-color cursor-pointer" 
                                alt="Visit" 
                                onClick={() => setPhotoViewer(url)}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                       <div className="space-y-1.5">
                         <div className="flex items-center gap-2 text-text-secondary">
                            <Notebook size={12} className="text-accent-color" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Notițe Lucrare</span>
                         </div>
                         <textarea 
                            className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-medium outline-none focus:border-accent-color min-h-[60px] resize-none"
                            placeholder="Detalii lucrare sau observații..."
                            value={finishNote}
                            onChange={(e) => setFinishNote(e.target.value)}
                         />
                      </div>
                      
                      {selectedVisit.status === 'Finalizat' && (
                        <div className="space-y-1.5 border-t border-border-color/30 pt-2 mt-2">
                          <div className="flex items-center gap-2 text-text-secondary mb-1">
                              <CalendarIcon size={12} className="text-accent-color" />
                              <span className="text-[11px] font-bold uppercase tracking-wider">Modificare Dată/Oră Execuție</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-text-secondary mb-1">Dată</label>
                                <input type="date" value={editVisitDate} onChange={e => setEditVisitDate(e.target.value)} className="w-full bg-bg-main border border-border-color rounded-md px-2 py-1 text-sm outline-none focus:border-accent-color text-main" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-text-secondary mb-1">Oră Start</label>
                                <input type="time" value={editVisitStartTime} onChange={e => setEditVisitStartTime(e.target.value)} className="w-full bg-bg-main border border-border-color rounded-md px-2 py-1 text-sm outline-none focus:border-accent-color text-main" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-text-secondary mb-1">Oră Stop</label>
                                <input type="time" value={editVisitEndTime} onChange={e => setEditVisitEndTime(e.target.value)} className="w-full bg-bg-main border border-border-color rounded-md px-2 py-1 text-sm outline-none focus:border-accent-color text-main" />
                              </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {(() => {
                    const prop = properties.find(p => p.id === currentVisit.propertyId);
                    if (prop && prop.contractType === 'maintenance' && prop.maintenanceFrequency === 'occasional') {
                        return (
                          <div className="space-y-2 mt-2 p-3 bg-accent-color/5 border border-accent-color/20 rounded-lg">
                            <div className="flex items-center gap-2 text-accent-color mb-1">
                              <DollarSign size={12} />
                              <span className="text-[11px] font-bold uppercase tracking-wider">Facturare Ocazională</span>
                            </div>
                            <div className="flex gap-2">
                               <input 
                                  type="number" 
                                  className="w-full bg-bg-card border border-border-color rounded-md px-3 py-2 text-sm font-bold outline-none focus:border-accent-color"
                                  placeholder="Valoare intervenție (RON)"
                                  value={interventieCost}
                                  onChange={(e) => setInterventieCost(e.target.value)}
                               />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-2 text-xs font-medium text-main">
                               <input 
                                  type="checkbox" 
                                  className="w-4 h-4 accent-accent-color rounded"
                                  checked={interventieIncasata}
                                  onChange={(e) => setInterventieIncasata(e.target.checked)}
                               />
                               Suma a fost deja încasată (nu adăuga la sold)
                            </label>
                          </div>
                        );
                    }
                    return null;
                })()}

                <div className="space-y-2">
                   <div className="flex items-center gap-2 text-text-secondary mb-1">
                      <List size={12} className="text-accent-color" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Servicii Efectuate</span>
                   </div>
                   <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar border border-border-color/10 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                      {serviceTypes.filter(st => st.isActive !== false).map(st => {
                        const client = clients.find(c => c.id === currentVisit.clientId);
                        let suprafata = client?.suprafataMp || 0;
                        let matchedProp = null;
                        if (currentVisit.propertyId) {
                          matchedProp = properties.find(p => p.id === currentVisit.propertyId);
                        }
                        if (!matchedProp && currentVisit.clientId) {
                          const addr = currentVisit.propertyAddress || currentVisit.clientAddress;
                          if (addr) {
                            const normAddr = normalizeAddress(addr);
                            matchedProp = properties.find(p => 
                              p.clientId === currentVisit.clientId && 
                              (normalizeAddress(p.address) === normAddr || normalizeAddress(p.name) === normAddr)
                            );
                          }
                        }
                        if (matchedProp && matchedProp.surfaceArea) {
                          suprafata = matchedProp.surfaceArea;
                        }
                        
                        const startTime = (currentVisit.currentSessionStart && currentVisit.currentSessionStart.toDate) ? currentVisit.currentSessionStart.toDate() : new Date();
                        const durationHours = ((new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(2);

                        return (
                          <div key={st.id} className="flex items-center gap-2 px-2 py-1 h-8 rounded-md bg-bg-main border border-border-color overflow-hidden">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 accent-accent-color flex-shrink-0" 
                              checked={selectedServices[st.id]?.selected || false} 
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                let quantity = selectedServices[st.id]?.quantity || '';
                                
                                if (isChecked && !quantity) {
                                  const unit = (st.unit || '').toLowerCase();
                                  const name = (st.name || '').toLowerCase();
                                  if (name.includes('fertilizare') || name.includes('ingrasamant')) {
                                    quantity = ((suprafata * defaultFertilizerDosage) / 1000).toFixed(2);
                                  } else if (unit === 'm²' || unit === 'mp' || unit === 'm2') {
                                    quantity = suprafata.toString();
                                  } else if (unit === 'ora' || unit === 'ore' || unit === 'h') {
                                    quantity = durationHours;
                                  }
                                }
                                
                                setSelectedServices({
                                  ...selectedServices, 
                                  [st.id]: { ...selectedServices[st.id], selected: isChecked, quantity }
                                });
                              }} 
                            />
                            <p className="flex-1 text-[11px] font-bold uppercase text-main leading-tight truncate">{st.name}</p>
                            {selectedServices[st.id]?.selected && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <input 
                                  type="number" 
                                  className="w-14 h-5 bg-bg-card border border-border-color px-1 rounded-sm text-[11px] font-bold m-0 outline-none text-center" 
                                  style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                                  value={selectedServices[st.id]?.quantity || ''} 
                                  onChange={(e) => setSelectedServices({...selectedServices, [st.id]: {...selectedServices[st.id], quantity: e.target.value}})} 
                                />
                                <span className="text-[8px] font-black text-text-secondary uppercase w-4">{st.unit}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                   </div>
                </div>
             </div>

             <button 
                onClick={handleFinalize}
                disabled={isProcessing}
                className="w-full stihl-button rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md mt-4 py-3 flex items-center justify-center gap-2 flex-shrink-0"
             >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                SALVEAZĂ RAPORTUL
             </button>

             <button 
                onClick={() => {
                    const num1 = Math.floor(Math.random() * 10) + 1;
                    const num2 = Math.floor(Math.random() * 10) + 1;
                    setMathProblem({num1, num2, answer: ''});
                    setConfirmationModal({
                        title: "Anulare Sesiune Activă",
                        message: "Ești sigur că vrei să anulezi cronometrul? Această lucrare va reveni la starea de Programat și raportul nu va fi salvat.",
                        requireMath: true,
                        onConfirm: async () => {
                            try {
                                if (selectedVisit.autoScheduledNextVisitId) {
                                    try {
                                        await deleteDoc(doc(db, 'visits', selectedVisit.autoScheduledNextVisitId));
                                    } catch (err) {
                                        console.error("Failed to delete auto-scheduled visit:", err);
                                    }
                                }
                                await updateDoc(doc(db, 'visits', selectedVisit.id), {
                                    status: 'Programat',
                                    currentSessionStart: null,
                                    nextVisitScheduled: false,
                                    autoScheduledNextVisitId: null
                                });
                                onClose();
                            } catch (e: any) { alert(e.message); }
                        }
                    });
                }}
                disabled={isProcessing}
                className="mt-3 text-[11px] text-text-secondary/60 hover:text-red-500 font-medium underline flex-shrink-0 text-center transition-colors pb-1"
             >
                Ai pornit din greșeală? Anulează pornirea
             </button>
          </div>
        </div>
  );
};
