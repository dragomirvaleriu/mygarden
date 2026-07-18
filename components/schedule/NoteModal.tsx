import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  visit: any;
  type: 'view' | 'add';
  finishNote: string;
  setFinishNote: (note: string) => void;
}

export const NoteModal: React.FC<Props> = ({ isOpen, onClose, visit, type, finishNote, setFinishNote }) => {
  const { t } = useTranslation();

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

  if (!isOpen || !visit) return null;

  return (
    <div className="fixed inset-0 z-[2010] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose}></div>
      <div className="stihl-card w-full max-w-sm rounded-lg p-6 relative bg-bg-card">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary hover:text-main">
          <X size={20} />
        </button>
        <div className="mb-4">
            <h3 className="text-lg font-black text-main">{type === 'view' ? t('Edit Note') : t('Add Note')}</h3>
            <p className="text-xs font-bold text-text-secondary truncate mt-0.5" title={`${visit.clientName} ${visit.propertyAddress ? `- ${visit.propertyAddress}` : ''}`}>
              {visit.clientName} {visit.propertyAddress ? `- ${visit.propertyAddress}` : ''}
            </p>
        </div>
        <textarea 
          className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-medium outline-none focus:border-accent-color min-h-[100px] mb-6"
          placeholder={t("Add note...")}
          value={finishNote}
          onChange={(e) => setFinishNote(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-xs font-bold uppercase bg-bg-main text-text-secondary">Închide</button>
          <button onClick={async () => {
            await updateDoc(doc(db, 'visits', visit.id), { finishNote: finishNote || null });
            onClose();
          }} className="px-4 py-2 rounded-md text-xs font-bold uppercase bg-accent-color text-white">{t('Save')}</button>
        </div>
      </div>
    </div>
  );
};
