import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, FileText, FileSpreadsheet, File } from 'lucide-react';

interface ExportFormatModalProps {
  onClose: () => void;
  onSelectFormat: (format: 'pdf' | 'excel' | 'word' | 'txt') => void;
  paymentMethod: 'card' | 'cash' | 'financial';
}

export function ExportFormatModal({ onClose, onSelectFormat, paymentMethod }: ExportFormatModalProps) {
  const { t } = useTranslation();

  let subtitle = '';
  if (paymentMethod === 'card') subtitle = t('Card / Transfer');
  else if (paymentMethod === 'cash') subtitle = t('Cash');
  else if (paymentMethod === 'financial') subtitle = t('Financial Report');

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="stihl-card w-full max-w-lg bg-bg-card rounded-2xl p-6 relative shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -z-10 blur-3xl"></div>
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-main uppercase tracking-tight">
              {t('Choose Export Format')}
            </h3>
            <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] mt-1">
              {subtitle}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-bg-main rounded-2xl hover:bg-red-500 hover:text-white transition-all group"
          >
            <X size={16} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onSelectFormat('pdf')}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border-color bg-bg-main hover:bg-red-500/10 hover:border-red-500/30 transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <span className="font-bold text-main">{t('Export to PDF')}</span>
          </button>

          <button
            onClick={() => onSelectFormat('excel')}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border-color bg-bg-main hover:bg-green-500/10 hover:border-green-500/30 transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileSpreadsheet size={24} />
            </div>
            <span className="font-bold text-main">{t('Export to Excel')}</span>
          </button>

          <button
            onClick={() => onSelectFormat('word')}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border-color bg-bg-main hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <File size={24} />
            </div>
            <span className="font-bold text-main">{t('Export to Word')}</span>
          </button>

          <button
            onClick={() => onSelectFormat('txt')}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border-color bg-bg-main hover:bg-gray-500/10 hover:border-gray-500/30 transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-gray-500/10 text-gray-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <span className="font-bold text-main">{t('Export to TXT')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
