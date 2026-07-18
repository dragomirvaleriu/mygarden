import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, Calculator, Database, FileText, Table, HardDriveDownload, HardDriveUpload, Shield } from 'lucide-react';

interface Props {
  calcSurface: number;
  setCalcSurface: (val: number) => void;
  calcDosage: number;
  handleDosageChange: (val: number) => Promise<void>;
  calcResult: number;
  exportJSON: () => Promise<void>;
  importJSON: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  exportPDF: () => Promise<void>;
  exportExcel: () => Promise<void>;
  isProcessing: boolean;
  view?: 'tools' | 'calculator' | 'all';
}

const DataTools: React.FC<Props> = ({
  calcSurface,
  setCalcSurface,
  calcDosage,
  handleDosageChange,
  calcResult,
  exportJSON,
  importJSON,
  exportPDF,
  exportExcel,
  isProcessing,
  view = 'all'
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="space-y-8">
      {/* ────── BACKUP & RESTORE (Priority Section) ────── */}
      {(view === 'all' || view === 'tools') && (
      <div className="stihl-card rounded-2xl p-6 bg-bg-card border-2 border-accent-color/20 shadow-lg">
        <h3 className="text-xs font-black text-accent-color uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
          <Shield size={16} />
          {t('Backup & Restore')}
        </h3>
        <p className="text-[11px] text-text-secondary font-medium mb-5 leading-relaxed">
          {t('Backup Description')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Create Full Backup */}
          <button 
            onClick={exportJSON}
            disabled={isProcessing}
            className="flex items-center gap-4 p-5 bg-accent-color/5 border border-accent-color/20 rounded-xl hover:bg-accent-color hover:text-white transition-all group disabled:opacity-50 active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-color/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <HardDriveDownload size={20} className="text-accent-color group-hover:text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-widest text-main group-hover:text-white">{t('Create Backup')}</p>
              <p className="text-[11px] text-text-secondary group-hover:text-white/70 mt-0.5">JSON • {t('All')} collections</p>
            </div>
          </button>

          {/* Restore from Backup */}
          <label className="flex items-center gap-4 p-5 bg-red-500/5 border border-red-500/20 rounded-xl hover:bg-red-600 hover:text-white transition-all group cursor-pointer active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <HardDriveUpload size={20} className="text-red-500 group-hover:text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-widest text-main group-hover:text-white">{t('Restore Backup')}</p>
              <p className="text-[11px] text-text-secondary group-hover:text-white/70 mt-0.5">{t('Restore Warning')}</p>
            </div>
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              onChange={importJSON}
              disabled={isProcessing}
              ref={fileInputRef}
            />
          </label>
        </div>
      </div>
      )}

      {/* ────── FERTILIZER CALCULATOR ────── */}
      {(view === 'all' || view === 'calculator') && (
      <div className="stihl-card rounded-2xl p-6 bg-bg-card border border-border-color">
        <h3 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
          <Calculator size={16} className="text-accent-color" />
          {t('Fertilizer Calculator')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Surface')} (m²)</label>
            <input 
              type="number" 
              className="w-full bg-bg-main rounded-xl px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm shadow-inner" 
              value={calcSurface || ''} 
              onChange={e => setCalcSurface(Number(e.target.value))}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Dosage')} (g/m²)</label>
            <input 
              type="number" 
              className="w-full bg-bg-main rounded-xl px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm shadow-inner" 
              value={calcDosage || ''} 
              onChange={e => handleDosageChange(Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>
        <div className="bg-bg-main rounded-xl p-4 mt-4 border border-border-color text-center shadow-inner">
          <p className="text-[11px] font-black text-text-secondary uppercase tracking-[0.2em] mb-1">{t('Calculated Dosage')}</p>
          <p className="text-3xl font-black text-accent-color tracking-tighter">
            {calcResult.toFixed(2)} <span className="text-sm text-main uppercase ml-1">kg</span>
          </p>
        </div>
      </div>
      )}

      {/* ────── EXPORT TOOLS ────── */}
      {(view === 'all' || view === 'tools') && (
      <div className="stihl-card rounded-2xl p-6 bg-bg-card border border-border-color">
        <h3 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
          <Download size={16} className="text-accent-color" />
          {t('Export Tools')}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={exportPDF}
            disabled={isProcessing}
            className="flex flex-col items-center gap-2 p-4 bg-bg-main border border-border-color rounded-xl hover:border-accent-color transition-all disabled:opacity-50 group active:scale-95"
          >
            <FileText size={18} className="text-text-secondary group-hover:text-accent-color transition-colors" />
            <span className="text-[11px] font-black uppercase tracking-widest text-main">{t('Export PDF')}</span>
          </button>
          <button 
            onClick={exportExcel}
            disabled={isProcessing}
            className="flex flex-col items-center gap-2 p-4 bg-bg-main border border-border-color rounded-xl hover:border-accent-color transition-all disabled:opacity-50 group active:scale-95"
          >
            <Table size={18} className="text-text-secondary group-hover:text-accent-color transition-colors" />
            <span className="text-[11px] font-black uppercase tracking-widest text-main">{t('Export Excel')}</span>
          </button>
        </div>
      </div>
      )}
    </section>
  );
};

export default DataTools;
