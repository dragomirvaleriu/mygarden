import React from 'react';
import { X, Check, ArrowRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  limitReached?: boolean;
}

export const UpsellModal: React.FC<UpsellModalProps> = ({
  isOpen,
  onClose,
  featureName,
  limitReached = true
}) => {
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="w-full max-w-lg relative bg-bg-card rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in duration-200 border border-border-color">
        {/* Header Graphic */}
        <div className="bg-gradient-to-r from-accent-color to-blue-600 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="bg-white/20 p-3 rounded-full mb-4 shadow-lg backdrop-blur-sm">
              <Sparkles size={32} className="text-white animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">
              {limitReached ? t('Limită Atinsă!') : t('Funcție Premium')}
            </h2>
            <p className="text-white/90 text-sm font-medium">
              {limitReached 
                ? `${t('Ai atins limita planului Free pentru')} ${featureName || t('această acțiune')}.` 
                : `${featureName || t('Această funcționalitate')} ${t('este disponibilă doar în planul PRO.')}`}
            </p>
          </div>
          
          {/* Decorative shapes */}
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
             <h3 className="text-sm font-bold text-orange-500 mb-2 flex items-center gap-2">
                <X size={16} /> {t('Limitările Planului FREE:')}
             </h3>
             <ul className="text-xs font-semibold text-text-secondary space-y-1.5 ml-6 list-disc">
                <li>{t('Maxim 10 clienți')}</li>
                <li>{t('Maxim 3 adăugări de Echipamente pe zi')}</li>
                <li>{t('Funcționalități avansate blocate')}</li>
             </ul>
          </div>

          <h3 className="text-base font-bold text-main mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-accent-color"/> {t('Treci la PRO și ai totul NELIMITAT:')}
          </h3>
          
          <ul className="space-y-3 mb-8">
            {[
              t('Clienți Nelimitați'),
              t('Echipamente Nelimitate'),
              t('Planificator de Rute Inteligent'),
              t('Rapoarte Avansate și Statistici'),
              t('Suport Prioritar 24/7')
            ].map((benefit, idx) => (
              <li key={idx} className="flex items-center gap-3">
                <div className="bg-emerald-500/20 p-1 rounded-full text-emerald-500">
                  <Check size={16} className="font-bold" />
                </div>
                <span className="text-sm font-semibold text-text-secondary">{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => {
                onClose();
                // Redirect or open contact form for upgrade
                window.location.href = 'mailto:contact@landscapeos.ro?subject=Upgrade to PRO';
              }}
              className="w-full bg-accent-color hover:bg-accent-color/90 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-accent-color/30"
            >
              {t('Contactează-ne pentru Upgrade')} <ArrowRight size={18} />
            </button>
            <button 
              onClick={onClose}
              className="w-full py-3 text-sm font-bold text-text-secondary hover:text-main transition-colors"
            >
              {t('Poate mai târziu')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
