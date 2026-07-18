import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { db, doc, updateDoc } from '../services/firebase';
import { PotentialClient } from '../src/types';
import { getDay } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lead: PotentialClient | null;
  workDays?: 'L-V' | 'L-S' | 'L-D';
}

const EditLeadModal: React.FC<Props> = ({ isOpen, onClose, lead, workDays = 'L-S' }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    telefon: '',
    nume: '',
    adresa: '',
    data: '',
    notite: ''
  });

  useEffect(() => {
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

  useEffect(() => {
    if (lead) {
      setFormData({
        telefon: lead.telefon || '',
        nume: lead.nume || '',
        adresa: lead.adresa || '',
        data: lead.nextActionDate || lead.data || '',
        notite: lead.notite || ''
      });
    }
  }, [lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    // Validate date
    if (formData.data) {
      const selectedDate = new Date(formData.data);
      if (!isNaN(selectedDate.getTime())) {
        const dayOfWeek = getDay(selectedDate);
        let isWorkingDay = true;
        if (workDays === 'L-V' && (dayOfWeek === 0 || dayOfWeek === 6)) isWorkingDay = false;
        if (workDays === 'L-S' && dayOfWeek === 0) isWorkingDay = false;

        if (!isWorkingDay) {
          alert(t('Working Day Error'));
          return;
        }
      }
    }

    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        ...formData,
        nextActionDate: formData.data // Keep nextActionDate in sync with data
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert(t('Error updating'));
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="stihl-card w-full max-w-md rounded-lg p-6 relative bg-bg-card animate-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary hover:text-main"><X size={20} /></button>
        <h3 className="text-lg font-black text-main mb-6">{t('Edit Lead')}</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder={t('Phone')} required className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2" value={formData.telefon} onChange={e => setFormData({...formData, telefon: e.target.value})} />
          <input type="text" placeholder={`${t('Name')} (${t('Optional')})`} className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2" value={formData.nume} onChange={e => setFormData({...formData, nume: e.target.value})} />
          <input type="text" placeholder={t('Address')} required className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2" value={formData.adresa} onChange={e => setFormData({...formData, adresa: e.target.value})} />
          <input type="date" required className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} />
          <textarea placeholder={t('Note')} className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2" value={formData.notite} onChange={e => setFormData({...formData, notite: e.target.value})} />
          
          <button type="submit" className="w-full stihl-button py-3 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md mt-2 flex items-center justify-center gap-2">
            <Check size={16} /> {t('Save')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditLeadModal;
