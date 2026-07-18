import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db, doc, updateDoc, query, where, addDoc, collection, deleteDoc } from '../services/firebase';
import { ServiceType, Page } from '../src/types';
import { Plus, Trash2, Edit2, ArrowLeft, GripVertical, CheckCircle2, Circle } from 'lucide-react';
import { logger } from '../services/logger';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  organizationId: string;
  onNavigate: (page: Page) => void;
}

interface SortableRowProps {
  s: ServiceType;
  idx: number;
  toggleDefault: (s: ServiceType) => void;
  toggleActive: (s: ServiceType) => void;
  onEdit: (s: ServiceType) => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}

const SortableRow: React.FC<SortableRowProps> = ({ 
  s, 
  idx, 
  toggleDefault, 
  toggleActive, 
  onEdit, 
  onDelete, 
  t 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: s.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 50 : undefined,
  } as React.CSSProperties;

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      className="hover:bg-accent-color/[0.02] transition-colors group bg-bg-card"
    >
      <td className="px-6 py-4 align-middle">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-1 cursor-grab active:cursor-grabbing text-text-secondary/40 hover:text-text-secondary/80 rounded transition-colors"
          >
            <GripVertical size={16} />
          </button>
          <span className="text-[11px] font-black text-text-secondary">{idx + 1}</span>
        </div>
      </td>
      <td className="px-6 py-4 align-middle">
        <span className="text-[11px] font-black text-main">{s.name}</span>
      </td>
      <td className="px-6 py-4 align-middle">
        <span className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">{s.unit}</span>
      </td>
      <td className="px-6 py-4 align-middle">
        <span className="text-[11px] font-black text-main">{s.cost}</span>
      </td>
      <td className="px-6 py-4 align-middle">
        <div className="flex justify-center">
          <button 
            type="button"
            onClick={() => toggleDefault(s)}
            className={`p-1 transition-colors ${s.isDefault ? 'text-accent-color' : 'text-text-secondary/30 hover:text-accent-color/50'}`}
          >
            {s.isDefault ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>
        </div>
      </td>
      <td className="px-6 py-4 align-middle">
        <div className="flex justify-center">
          <button 
            type="button"
            onClick={() => toggleActive(s)}
            className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${
              s.isActive !== false 
                ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' 
                : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
            }`}
          >
            {s.isActive !== false ? t('Active') : t('Inactive_status')}
          </button>
        </div>
      </td>
      <td className="px-6 py-4 align-middle">
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            type="button"
            onClick={() => onEdit(s)}
            className="p-2 text-text-secondary hover:text-accent-color transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button 
            type="button"
            onClick={() => onDelete(s.id)}
            className="p-2 text-text-secondary hover:text-red-500 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
};

const ServicesConfig: React.FC<Props> = ({ organizationId, onNavigate }) => {
  const { t } = useTranslation();
  const servicesQuery = React.useMemo(() => {
    if (!organizationId) return null;
    return query(collection(db, 'service_types'), where('organizationId', '==', organizationId));
  }, [organizationId]);

  const { data: services, loading } = useFirestoreQuery<ServiceType>(servicesQuery, { pageSize: 0 });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [newService, setNewService] = useState<Partial<ServiceType>>({
    name: '',
    unit: 'mp',
    cost: 0,
    isDefault: false,
    isActive: true,
    order: 0
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedServices = React.useMemo(() => {
    return [...services].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [services]);

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const serviceData = {
        ...newService,
        organizationId,
        order: newService.order !== undefined ? newService.order : services.length,
        isActive: newService.isActive !== false
      };

      if (editingServiceId) {
        await updateDoc(doc(db, 'service_types', editingServiceId), serviceData);
        logger.log(t('Service updated'), "success");
      } else {
        await addDoc(collection(db, 'service_types'), serviceData);
        logger.log(t('Service added'), "success");
      }
      setShowAddModal(false);
      setEditingServiceId(null);
      setNewService({ name: '', unit: 'mp', cost: 0, isDefault: false, isActive: true, order: 0 });
    } catch (e) { logger.log(t('Error saving service'), "error"); }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm(t('Are you sure you want to delete this service?'))) return;
    try {
      await deleteDoc(doc(db, 'service_types', id));
      logger.log(t('Service deleted'), "warn");
    } catch (e) { logger.log(t('Error deleting'), "error"); }
  };

  const toggleDefault = async (service: ServiceType) => {
    try {
      await updateDoc(doc(db, 'service_types', service.id), { isDefault: !service.isDefault });
    } catch (e) { logger.log(t('Error updating'), "error"); }
  };

  const toggleActive = async (service: ServiceType) => {
    try {
      await updateDoc(doc(db, 'service_types', service.id), { isActive: service.isActive === false });
      logger.log(t('Status updated'), "success");
    } catch (e) { logger.log(t('Error updating status'), "error"); }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedServices.findIndex((item) => item.id === active.id);
    const newIndex = sortedServices.findIndex((item) => item.id === over.id);

    const newSortedList = arrayMove(sortedServices, oldIndex, newIndex);
    
    try {
      const batchPromises = newSortedList.map((service, index) => {
        return updateDoc(doc(db, 'service_types', service.id), { order: index });
      });
      await Promise.all(batchPromises);
      logger.log(t('Order updated'), "success");
    } catch (e) {
      logger.log(t('Error updating order'), "error");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate(Page.Administration)}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors text-text-secondary"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-main uppercase tracking-tight">{t('Services')}</h1>
            <p className="text-[11px] text-text-secondary font-black uppercase tracking-[0.2em] opacity-60">{t('Services Description')}</p>
          </div>
        </div>
        <button 
          onClick={() => { setEditingServiceId(null); setNewService({ name: '', unit: 'mp', cost: 0, isDefault: false, isActive: true, order: services.length }); setShowAddModal(true); }}
          className="bg-accent-color text-white px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg hover:shadow-accent-color/20 transition-all active:scale-95"
        >
          <Plus size={18} />
          {t('Add Service')}
        </button>
      </div>

      <div className="stihl-card bg-bg-card border border-border-color rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-main/50 border-b border-border-color">
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70 w-10">#</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70">{t('Name')}</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70">{t('Unit')}</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70">{t('Price')} (RON)</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70 text-center">{t('Default')}</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70 text-center">{t('Status')}</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <SortableContext items={sortedServices.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <tbody className="divide-y divide-border-color">
                  {sortedServices.map((s, idx) => (
                    <SortableRow 
                      key={s.id} 
                      s={s} 
                      idx={idx} 
                      toggleDefault={toggleDefault} 
                      toggleActive={toggleActive}
                      onEdit={(service) => { setEditingServiceId(service.id); setNewService(service); setShowAddModal(true); }}
                      onDelete={handleDeleteService}
                      t={t}
                    />
                  ))}
                  {services.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-text-secondary text-sm italic">
                        {t('No services configured')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowAddModal(false)}></div>
          <div className="stihl-card w-full max-w-lg p-0 relative animate-in zoom-in duration-300 bg-bg-card overflow-hidden rounded-2xl border border-border-color">
            <div className="bg-bg-main border-b border-border-color p-6">
              <h3 className="text-xl font-black text-main uppercase tracking-tight">
                {editingServiceId ? t('Edit Service') : t('Add Service')}
              </h3>
            </div>
            <form onSubmit={handleSaveService} className="p-6 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Service Name')}</label>
                <input required type="text" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent-color" value={newService.name || ''} onChange={e => setNewService({...newService, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Unit')}</label>
                  <input required type="text" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent-color" value={newService.unit || ''} onChange={e => setNewService({...newService, unit: e.target.value})} placeholder="ex: mp, h, buc" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Price')} (RON)</label>
                  <input required type="number" step="0.01" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent-color" value={newService.cost || 0} onChange={e => setNewService({...newService, cost: parseFloat(e.target.value)})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-bg-main rounded-xl border border-border-color">
                  <input 
                      type="checkbox" 
                      id="isDefault"
                      className="w-5 h-5 accent-accent-color cursor-pointer"
                      checked={newService.isDefault || false} 
                      onChange={e => setNewService({...newService, isDefault: e.target.checked})} 
                  />
                  <label htmlFor="isDefault" className="text-xs font-bold text-main cursor-pointer uppercase tracking-wider">{t('Mark as default service')}</label>
                </div>

                <div className="flex items-center gap-3 p-4 bg-bg-main rounded-xl border border-border-color">
                  <input 
                      type="checkbox" 
                      id="isActive"
                      className="w-5 h-5 accent-accent-color cursor-pointer"
                      checked={newService.isActive !== false} 
                      onChange={e => setNewService({...newService, isActive: e.target.checked})} 
                  />
                  <label htmlFor="isActive" className="text-xs font-bold text-main cursor-pointer uppercase tracking-wider">{t('Active service')}</label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 bg-bg-main border border-border-color rounded-xl font-bold uppercase tracking-widest text-[11px] text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors">{t('Cancel')}</button>
                <button type="submit" className="px-8 py-3 bg-accent-color text-white rounded-xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-accent-color/20 hover:shadow-accent-color/40 transition-all active:scale-95">{t('Save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesConfig;
