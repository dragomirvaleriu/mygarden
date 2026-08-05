import React, { useState, useEffect } from 'react';
import { Crown, Zap, Star, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ─── Buy Button ────────────────────────────────────────
const BuyButton: React.FC<{ onClick: () => void; loading: boolean }> = ({ onClick, loading }) => {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="relative w-full group overflow-hidden"
      aria-label={t('Cumpără abonament anual My Garden PRO')}
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-accent-color via-amber-300 to-accent-color md:min-h-[104px] rounded-3xl blur opacity-60 group-hover:opacity-90 animate-pulse transition-opacity" />
      <div className="relative flex items-center justify-center gap-3 bg-gradient-to-r from-accent-color to-accent-hover hover:brightness-110 text-white font-black py-5 px-8 md:min-h-[104px] rounded-2xl transition-all duration-300 active:scale-95 shadow-xl shadow-accent-color/30">
        {loading ? (
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Zap size={22} className="shrink-0 fill-current" />
            <span className="text-base uppercase tracking-widest leading-tight text-center">{t('Începe Acum — 29 RON / An 🚀')}</span>
          </>
        )}
      </div>
    </button>
  );
};

// ─── Benefit Row ───────────────────────────────────────
const BenefitRow: React.FC<{ text: string; subtext?: string }> = ({ text, subtext }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 w-5 h-5 rounded-full bg-accent-color/20 flex items-center justify-center shrink-0">
      <CheckCircle2 size={13} className="text-accent-color" />
    </div>
    <div>
      <p className="text-sm font-bold text-white/90">{text}</p>
      {subtext && <p className="text-xs text-white/50 mt-0.5">{subtext}</p>}
    </div>
  </div>
);

export interface PremiumUpgradeTriggerItem {
  title: string;
  emoji: string;
  categoryLabel: string;
  /** Pre-formatted secondary line, e.g. "12 min · Mediu" for an article or "Dificultate: Mediu" for a plant. */
  meta: string;
}

interface PremiumUpgradeModalProps {
  triggerItem: PremiumUpgradeTriggerItem;
  onClose: () => void;
  onUpgrade: () => Promise<void>;
}

// ─── Premium Upgrade Modal ──────────────────────────────
// Shared paywall modal — triggered from both Academy (locked articles) and
// Explore (locked Encyclopedia plants). `triggerItem` carries just enough
// context (title/emoji/category/meta) to show a small preview of whatever
// the user tried to open, without either caller needing to know about the
// other's data shape.
const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({ triggerItem, onClose, onUpgrade }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleUpgrade = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onUpgrade();
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { text: t('Peste 50 de ghiduri și protocoale de sezon'), subtext: t('Actualizate lunar cu conținut nou de la agronomi') },
    { text: t('Enciclopedia completă: toate cele 287 de plante'), subtext: t('Fișe complete, inclusiv speciile dificile și rare') },
    { text: t('Modul SOS: Diagnoză imediată pentru boli și dăunători'), subtext: t('Brown Patch, Pythium, dăunători subterani și mai mult') },
    { text: t('Fără reclame, 100% știință aplicată'), subtext: t('Zero marketing. Doar informații verificate agronomic') },
  ];

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      <div className={`relative w-full sm:max-w-2xl max-h-[96dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] shadow-[0_0_120px_rgba(0,0,0,0.9)] transition-all duration-500 ${visible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'}`} style={{ scrollbarWidth: 'none' }}>
        <div className="absolute inset-0 bg-[#080f0c] rounded-t-[2rem] sm:rounded-[2rem]" />
        <div className="absolute inset-0 opacity-60 rounded-t-[2rem] sm:rounded-[2rem]" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(16,185,129,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(245,158,11,0.08) 0%, transparent 50%)' }} />
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        <div className="relative p-6 sm:p-8 md:p-10">
          <button onClick={onClose} className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/70 transition-all" aria-label={t('Închide')}>
            <X size={16} />
          </button>

          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-5">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.35)]">
                <Crown size={38} className="text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-9 h-9 bg-zinc-900 border-2 border-white/10 rounded-full flex items-center justify-center">
                <Zap size={15} className="text-amber-400" />
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-5 w-full max-w-sm">
              <span className="text-2xl select-none">{triggerItem.emoji}</span>
              <div className="text-left">
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{triggerItem.categoryLabel}</p>
                <p className="text-sm font-black text-white leading-snug">{triggerItem.title}</p>
                <p className="text-[10px] text-white/70 mt-0.5">{triggerItem.meta}</p>
              </div>
              <Zap size={14} className="text-amber-400 shrink-0 ml-auto" />
            </div>

            <h2 id="paywall-title" className="text-2xl sm:text-3xl font-black text-white tracking-tighter leading-tight mb-3">
              {t('Deblochează')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-color to-amber-400">Master Academy.</span>
              <br />{t('Devino expertul propriei grădini.')}
            </h2>
            <p className="text-sm text-white/75 leading-relaxed max-w-md">
              {t('Acces nelimitat la toate protocoalele secrete, diagnosticele AI și calculatoarele avansate pentru un an întreg.')}{' '}
              <span className="text-white/80 font-bold">{t('Totul pentru prețul unei cafele în oraș.')}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div className="relative">
              <div className="flex justify-center mb-3">
                <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5">
                  <Star size={12} className="text-amber-400" />
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">{t('Cel mai ales plan')}</span>
                </div>
              </div>
              <div className="relative bg-white/5 border border-white/10 rounded-3xl p-6 text-center overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-accent-color/10 blur-3xl rounded-full" />
                </div>
                <div className="relative flex items-center justify-center gap-3 mb-1">
                  <span className="text-white/30 line-through text-lg font-black">119 RON</span>
                  <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full text-[9px] font-black text-red-400 uppercase tracking-widest">{t('−76% azi')}</span>
                </div>
                <div className="relative flex items-end justify-center gap-2">
                  <span className="text-6xl font-black text-white leading-none tracking-tighter">29</span>
                  <div className="flex flex-col items-start mb-2">
                    <span className="text-xl font-black text-accent-color">RON</span>
                    <span className="text-xs font-bold text-white/40 uppercase tracking-wider">{t('/ an')}</span>
                  </div>
                </div>
                <p className="relative text-[12px] text-accent-color font-bold mt-2">{t('≈ 0.08 RON pe zi • Mai puțin decât o cafea pe lună')}</p>
                <div className="relative mt-3 pt-3 border-t border-white/5">
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">{t('Facturat anual · O singură plată')}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 justify-center">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{t('Ce deblochezi instant')}</p>
              {benefits.map((b, i) => <BenefitRow key={i} text={b.text} subtext={b.subtext} />)}
            </div>
          </div>

          <div className="space-y-4">
            <BuyButton onClick={handleUpgrade} loading={loading} />
            <div className="flex items-start gap-3 bg-white/3 border border-white/5 rounded-2xl px-5 py-4">
              <ShieldCheck size={18} className="text-accent-color shrink-0 mt-0.5" />
              <p className="text-xs text-white/75 leading-relaxed">
                <span className="font-black text-white/80">{t('Fără reînnoire automată ascunsă.')}</span>{' '}
                {t('Plătești o dată, ai acces complet')} <span className="font-black text-accent-color">{t('365 de zile')}</span>. {t('Nicio surpriză pe card.')}
              </p>
            </div>
            <button onClick={onClose} className="w-full text-center text-[11px] text-white/70 hover:text-white/90 font-medium py-2 transition-colors">
              {t('Continuă cu conținut gratuit')}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest text-center mb-4">{t('Gratuit vs. PRO')}</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="text-white/30 font-black uppercase tracking-wider text-[9px] text-left">{t('Funcție')}</div>
              <div className="text-white/30 font-black uppercase tracking-wider text-[9px]">{t('Gratuit')}</div>
              <div className="text-amber-400 font-black uppercase tracking-wider text-[9px]">PRO 👑</div>
              {[
                [t('Ghiduri de bază'), '4', '50+'],
                [t('Plante în Enciclopedie'), '40', '287'],
                [t('Modul SOS / Diagnoze'), '—', '✓'],
                [t('Calendar Sezonier complet'), '—', '✓'],
                [t('Fără reclame'), '—', '✓'],
              ].map(([feat, free, pro], i) => (
                <React.Fragment key={i}>
                  <div className="text-left py-2 border-t border-white/5 text-white/50 text-[11px]">{feat}</div>
                  <div className={`py-2 border-t border-white/5 text-[11px] ${free === '—' ? 'text-white/20' : 'text-white/60'}`}>{free}</div>
                  <div className="py-2 border-t border-white/5 text-[11px] text-accent-color font-bold">{pro}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumUpgradeModal;
