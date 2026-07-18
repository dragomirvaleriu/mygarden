import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { db, collection, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, query, where } from '../services/firebase';
import { Equipment, Page, ServiceRecord } from '../src/types';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { usePlan } from '../src/hooks/usePlan';
import { toast } from 'react-hot-toast';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { Wrench, Plus, CheckCircle, Search, Edit2, Trash2, Battery, BatteryCharging, AlertTriangle, PenTool, Image as ImageIcon, MapPin, X, ArrowLeft, History } from 'lucide-react';
import { UpsellModal } from '../components/UpsellModal';

interface Props {
  organizationId: string;
  onNavigate: (page: Page) => void;
}

const ServiceHistoryModal = ({ isOpen, onClose, equipment, onSave }: { isOpen: boolean, onClose: () => void, equipment: Equipment | null, onSave: (record: ServiceRecord) => void }) => {
  const { t } = useTranslation();
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<string>('Oil Change');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState<number | ''>('');

  if (!isOpen || !equipment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: ServiceRecord = {
      id: Math.random().toString(36).substring(7),
      date: date,
      type,
      description
    };
    if (cost !== '') {
      newRecord.cost = Number(cost);
    }
    onSave(newRecord);
    setDate(new Date().toISOString().split('T')[0]);
    setType('Oil Change');
    setDescription('');
    setCost('');
  };

  const serviceTypes = ['Oil Change', 'Blade Sharpening', 'Filter Replacement', 'Spark Plug', 'Greasing', 'Pump/Nozzle Cleaning', 'General Maintenance', 'Other'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border-color sticky top-0 bg-bg-card z-10">
          <div>
            <h2 className="text-lg font-black text-main uppercase tracking-tight">{t('Service History')}</h2>
            <p className="text-xs font-bold text-text-secondary">{equipment.name}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Add New Record Form */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-text-secondary uppercase tracking-widest border-b border-border-color pb-2">{t('Add Service Record')}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Date')}</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-bg-main border border-border-color rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-accent-color" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Service Type')}</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-bg-main border border-border-color rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-accent-color appearance-none">
                  {serviceTypes.map(st => <option key={st} value={st}>{t(st)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Description')} ({t('Optional')})</label>
                <textarea rows={2} placeholder={t('Description')} value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-bg-main border border-border-color rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-accent-color resize-none"></textarea>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Cost (Optional)')}</label>
                <input type="number" placeholder="RON" value={cost} onChange={e => setCost(e.target.value ? Number(e.target.value) : '')} className="w-full bg-bg-main border border-border-color rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-accent-color" />
              </div>
              <button type="submit" className="w-full py-3 bg-accent-color text-white rounded-xl font-black uppercase tracking-widest text-[11px] hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-accent-color/20">
                {t('Save')}
              </button>
            </form>
          </div>

          {/* History List */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-text-secondary uppercase tracking-widest border-b border-border-color pb-2">{t('History')}</h3>
            <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {(!equipment.serviceHistory || equipment.serviceHistory.length === 0) ? (
                <p className="text-xs text-text-secondary italic">{t('No records')}</p>
              ) : (
                [...equipment.serviceHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(record => (
                  <div key={record.id} className="p-3 bg-bg-main rounded-xl border border-border-color text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-black text-main">{t(record.type)}</span>
                      <span className="text-[10px] font-bold text-text-secondary">{record.date}</span>
                    </div>
                    <p className="text-xs text-text-secondary mb-2">{record.description}</p>
                    {record.cost && <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">{record.cost} RON</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EquipmentPage: React.FC<Props> = ({ organizationId, onNavigate }) => {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState<Partial<Equipment>>({});
  const [upsellModal, setUpsellModal] = useState<{ isOpen: boolean, featureName: string }>({ isOpen: false, featureName: '' });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [serviceModal, setServiceModal] = useState<{ isOpen: boolean, equipment: Equipment | null }>({ isOpen: false, equipment: null });

  const equipmentQuery = useMemo(() => organizationId ? query(collection(db, 'equipment'), where('organizationId', '==', organizationId)) : null, [organizationId]);
  const { data: equipment, loading, hasMore, loadMore, loadingMore } = useFirestoreQuery<Equipment>(equipmentQuery, { pageSize: 0 });

  const { subscriptionTier } = usePlan();

  const handleSave = async () => {
    if (!organizationId) return;
    
    if (!currentEquipment.id && subscriptionTier === 'free') {
      const todayStr = new Date().toDateString();
      const equipmentAddedToday = equipment.filter(eq => {
        if (!eq.purchaseDate) return false;
        const date = (eq as any).createdAt?.toDate ? (eq as any).createdAt.toDate() : new Date(eq.purchaseDate as string | number | Date);
        return date.toDateString() === todayStr;
      });

      if (equipmentAddedToday.length >= 3) {
        setUpsellModal({ isOpen: true, featureName: 'adăugarea de Echipamente (max. 3/zi)' });
        return;
      }
    }

    try {
      if (currentEquipment.id) {
        await updateDoc(doc(db, 'equipment', currentEquipment.id), { ...currentEquipment, organizationId });
      } else {
        await addDoc(collection(db, 'equipment'), { ...currentEquipment, organizationId, purchaseDate: serverTimestamp(), createdAt: serverTimestamp() });
      }
      setIsFormOpen(false);
      setCurrentEquipment({});
    } catch (error) {
      console.error("Error saving equipment:", error);
      alert(t('Error saving equipment'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'equipment', id));
      setDeleteModal({ isOpen: false, id: null });
    } catch (error) {
      console.error("Error deleting equipment:", error);
      alert(t('Error deleting equipment'));
    }
  };

  const handleSaveService = async (record: ServiceRecord) => {
    if (!serviceModal.equipment) return;

    try {
      const eqRef = doc(db, 'equipment', serviceModal.equipment.id);
      const updatedHistory = [...(serviceModal.equipment.serviceHistory || []), record];
      await updateDoc(eqRef, { serviceHistory: updatedHistory });
      
      // Update local state optimistic
      setServiceModal(prev => ({
        ...prev,
        equipment: prev.equipment ? { ...prev.equipment, serviceHistory: updatedHistory } : null
      }));
    } catch (error) {
      console.error(error);
      alert(t('Error saving service record'));
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate(Page.Administration)}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors text-text-secondary"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-main uppercase tracking-tight">{t('Equipment')}</h1>
            <p className="text-[11px] text-text-secondary font-black uppercase tracking-[0.2em] opacity-60">{t('Equipment Description')}</p>
          </div>
        </div>
        <button 
          onClick={() => { setCurrentEquipment({}); setIsFormOpen(true); }} 
          className="bg-accent-color text-white px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg hover:shadow-accent-color/20 transition-all active:scale-95"
        >
          <Plus size={18} />
          {t('Add Equipment')}
        </button>
      </div>

      {isFormOpen && (
        <div className="stihl-card p-6 rounded-2xl mb-6 bg-bg-card border border-border-color animate-in slide-in-from-top duration-300">
          <h2 className="text-xl font-black mb-6 text-main uppercase tracking-tight">
            {currentEquipment.id ? t('Edit Equipment') : t('Add Equipment')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Name')}</label>
              <input type="text" placeholder={t('Name')} value={currentEquipment.name || ''} onChange={e => setCurrentEquipment({ ...currentEquipment, name: e.target.value })} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent-color" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Category')}</label>
              <input type="text" placeholder={t('Category')} value={currentEquipment.category || ''} onChange={e => setCurrentEquipment({ ...currentEquipment, category: e.target.value })} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent-color" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Value')} (RON)</label>
              <input type="number" placeholder={t('Value')} value={currentEquipment.value || ''} onChange={e => setCurrentEquipment({ ...currentEquipment, value: Number(e.target.value) })} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent-color" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Status')}</label>
              <select value={currentEquipment.status || 'operational'} onChange={e => setCurrentEquipment({ ...currentEquipment, status: e.target.value as Equipment['status'] })} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent-color appearance-none">
                <option value="operational">{t('Operational')}</option>
                <option value="in_service">{t('In Service')}</option>
                <option value="retired">{t('Retired')}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-8">
            <button onClick={() => setIsFormOpen(false)} className="px-6 py-3 bg-bg-main border border-border-color rounded-xl font-bold uppercase tracking-widest text-[11px] text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors">{t('Cancel')}</button>
            <button onClick={handleSave} className="px-8 py-3 bg-accent-color text-white rounded-xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-accent-color/20 hover:shadow-accent-color/40 transition-all active:scale-95">{t('Save')}</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {equipment.map(item => (
          <div key={item.id} className="stihl-card p-6 rounded-2xl bg-bg-card border border-border-color group hover:border-accent-color/50 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent-color/10 flex items-center justify-center text-accent-color">
                <Wrench size={24} />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setCurrentEquipment(item); setIsFormOpen(true); }} className="p-2 text-text-secondary hover:text-accent-color transition-colors" title={t('Edit')}><Edit2 size={18} /></button>
                <button onClick={() => setServiceModal({ isOpen: true, equipment: item })} className="p-2 text-text-secondary hover:text-blue-500 transition-colors" title={t('Service History')}><History size={18} /></button>
                <button onClick={() => setDeleteModal({ isOpen: true, id: item.id })} className="p-2 text-text-secondary hover:text-red-500 transition-colors" title={t('Delete')}><Trash2 size={18} /></button>
              </div>
            </div>
            <h3 className="text-lg font-black text-main mb-1">{item.name}</h3>
            <p className="text-[11px] font-bold text-text-secondary uppercase tracking-widest mb-4">{item.category}</p>
            
            <div className="space-y-2 pt-4 border-t border-border-color">
              <div className="flex justify-between text-xs items-center">
                <span className="text-text-secondary font-bold uppercase tracking-wider">{t('Value')}</span>
                <span className="text-main font-black">{item.value} RON</span>
              </div>
              <div className="flex justify-between text-xs items-center">
                <span className="text-text-secondary font-bold uppercase tracking-wider">{t('Status')}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest ${
                  item.status === 'operational' ? 'bg-green-500/10 text-green-500' : 
                  item.status === 'in_service' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
                }`}>
                  {t((item.status || 'operational').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))}
                </span>
              </div>
              <div className="flex justify-between text-xs items-center mt-2 pt-2 border-t border-border-color/30">
                <span className="text-text-secondary font-bold uppercase tracking-wider">{t('Service History')}</span>
                <button onClick={() => setServiceModal({ isOpen: true, equipment: item })} className="text-[10px] font-black bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded hover:bg-blue-500/20 transition-colors">
                  {item.serviceHistory?.length || 0} {t('Entries')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ServiceHistoryModal 
        isOpen={serviceModal.isOpen} 
        onClose={() => setServiceModal({ isOpen: false, equipment: null })} 
        equipment={serviceModal.equipment} 
        onSave={handleSaveService} 
      />

      <DeleteConfirmationModal 
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={() => deleteModal.id && handleDelete(deleteModal.id)}
        title={t('Delete Equipment')}
        message={t('Are you sure you want to delete this equipment?')}
      />

      {hasMore && (
        <div className="flex justify-center mt-8 pb-10">
          <button 
            onClick={loadMore} 
            disabled={loadingMore}
            className="bg-bg-main border border-border-color text-text-secondary px-8 py-3 rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {loadingMore ? t('Loading...') : t('Load More')}
          </button>
        </div>
      )}

      <UpsellModal 
        isOpen={upsellModal.isOpen}
        onClose={() => setUpsellModal({ isOpen: false, featureName: '' })}
        featureName={upsellModal.featureName}
      />
    </div>
  );
};

export default EquipmentPage;
