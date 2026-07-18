import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const DeleteConfirmationModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, title, message }) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="stihl-card w-full max-w-sm rounded-lg p-6 relative bg-bg-card animate-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary hover:text-main"><X size={20} /></button>
        <div className="flex items-center gap-3 mb-4 text-red-500">
          <AlertTriangle size={24} />
          <h3 className="text-lg font-black text-main">{title}</h3>
        </div>
        <p className="text-text-secondary mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-md font-bold uppercase tracking-wider text-xs border border-border-color text-text-secondary">{t('Cancel')}</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 py-2 rounded-md font-bold uppercase tracking-wider text-xs bg-red-600 text-white shadow-md">{t('Delete')}</button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
